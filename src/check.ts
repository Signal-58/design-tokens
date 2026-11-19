/**
 * `s58-tokens check`: read only, for CI. It reports:
 *
 * - generated files that don't match the configs (someone edited a config or a Figma export and
 *   didn't rebuild, or edited a generated file by hand);
 * - semantic tokens with code syntax whose value is raw instead of a reference: semantics point
 *   only at primitives or at other semantics;
 * - APCA floors a generated scale misses, unless the config accepts that miss;
 * - a plugin manifest whose name or id doesn't match the config, or that doesn't give the plugin
 *   the file's key for the file guard (`enablePrivatePluginApi`);
 * - once a project sets `build.semantics.exclude` or `codeSyntax` (every semantic in code): an
 *   exclusion that matches nothing, a semantic that's neither named nor excluded, and no file in
 *   the `s58/scss/semantics` format. (A mode that changes something and has no selector stops the
 *   build, which the check runs.)
 */
import fs from 'node:fs'
import path from 'node:path'

import type { TokensConfig } from './config'
import { builtFiles, dtcgFiles, type OutputFile } from './outputs'
import { generatedApcaFailures } from './palette/report'
import { fluidSemanticGroups, tokenTree } from './style-dictionary'
import { covers, isExcluded, isPulled } from './semantics/rules'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function outOfDate(files: OutputFile[], root: string): string[] {
  return files.flatMap(({ destination, output }) => {
    const file = path.join(root, destination)
    if (!fs.existsSync(file)) return [`${destination} is missing. Run s58-tokens build.`]
    return fs.readFileSync(file, 'utf8') === output
      ? []
      : [`${destination} doesn't match the configs. Run s58-tokens build.`]
  })
}

/** Semantic tokens (under `color` and the fluid semantic groups) with code syntax and a raw value. */
function rawSemantics(config: TokensConfig, root: string): string[] {
  const tree = tokenTree(config, root)
  const problems: string[] = []
  const walk = (node: unknown, at: string[]) => {
    if (!isRecord(node)) return
    if ('$value' in node) {
      const hasName = isRecord(node.$extensions) && 'com.figma.codeSyntax' in node.$extensions
      const value = node.$value
      if (hasName && !(typeof value === 'string' && /^\{.+\}$/.test(value))) {
        problems.push(
          `${at.join('.')} has a raw value; semantics should reference a primitive or another semantic.`,
        )
      }
      return
    }
    for (const [key, child] of Object.entries(node)) walk(child, [...at, key])
  }
  walk(tree.color, ['color'])
  const fluid = tree.fluid
  for (const group of fluidSemanticGroups(config.build?.semantics)) {
    if (isRecord(fluid)) walk(fluid[group], ['fluid', group])
  }
  return problems
}

/** `amber 6: Lc 39.7 on white, below 40` → `amber 6 on white`. */
const apcaKey = (failure: string) => failure.replace(/^(\S+ \d+): Lc [\d.]+ (on \w+),.*$/, '$1 $2')

function apcaMisses(config: TokensConfig): { problems: string[]; accepted: string[] } {
  const allowed = new Set(config.check?.allowApcaMisses ?? [])
  const { failures } = generatedApcaFailures(config.palette)
  return {
    problems: failures
      .filter((f) => !allowed.has(apcaKey(f)))
      .map((f) => `APCA floor missed: ${f}. Fix the scale, or accept it in check.allowApcaMisses.`),
    accepted: failures.filter((f) => allowed.has(apcaKey(f))),
  }
}

function manifestProblems(config: TokensConfig, root: string): string[] {
  const file = path.join(config.figma.plugin.dir ?? 'design-tokens/figma-plugin', 'manifest.json')
  if (!fs.existsSync(path.join(root, file))) return []
  const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as {
    name?: string
    id?: string
    enablePrivatePluginApi?: boolean
  }
  const { name, id } = config.figma.plugin
  const problems: string[] = []
  if (manifest.name !== name || manifest.id !== id) {
    problems.push(
      `${file} names the plugin "${manifest.name}" (${manifest.id}); the config says "${name}" (${id}).`,
    )
  }
  if (manifest.enablePrivatePluginApi !== true) {
    problems.push(
      `${file} doesn't set "enablePrivatePluginApi": true, which the file guard needs. Run s58-tokens figma plugin to add it.`,
    )
  }
  return problems
}

/** Every token in the pulled file, as collection, name and whether it has code syntax. */
function pulledTokens(json: Record<string, unknown>) {
  const out: { collection: string; name: string; named: boolean; modes: string[] }[] = []
  for (const [collection, node] of Object.entries(json)) {
    if (collection.startsWith('$') || !isRecord(node)) continue
    const info = isRecord(node.$extensions)
      ? node.$extensions['com.signal58.collection']
      : undefined
    const modes = isRecord(info) && Array.isArray(info.modes) ? (info.modes as string[]) : []
    const walk = (n: Record<string, unknown>, at: string[]) => {
      for (const [key, value] of Object.entries(n)) {
        if (key.startsWith('$') || !isRecord(value)) continue
        if ('$value' in value) {
          const ext = isRecord(value.$extensions) ? value.$extensions : {}
          out.push({
            collection,
            name: [...at, key].join('/'),
            named: 'com.figma.codeSyntax' in ext,
            modes,
          })
        } else walk(value, [...at, key])
      }
    }
    walk(node, [])
  }
  return out
}

/** Every semantic in code, once the project opts in. Before that, a note of what doesn't reach code. */
function semanticsProblems(
  config: TokensConfig,
  root: string,
): { problems: string[]; notes: string[] } {
  const semantics = config.build?.semantics
  if (!isPulled(semantics)) return { problems: [], notes: [] }
  const file = path.join(root, semantics.file)
  if (!fs.existsSync(file))
    return {
      problems: [`${semantics.file} is missing. Pull it with the plugin's Export.`],
      notes: [],
    }
  const tokens = pulledTokens(JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>)
  const exclude = semantics.exclude ?? []
  const unnamed = tokens.filter((t) => !t.named && !isExcluded(exclude, t.collection, t.name))
  const optedIn = semantics.exclude !== undefined || semantics.codeSyntax !== undefined
  const list = (items: string[]) =>
    items.length > 5
      ? `${items.slice(0, 5).join(', ')} and ${items.length - 5} more`
      : items.join(', ')
  if (!optedIn) {
    return {
      problems: [],
      notes: unnamed.length
        ? [
            `${unnamed.length} of Figma's semantics have no code syntax, so they don't reach code. Set build.semantics.exclude and codeSyntax to choose.`,
          ]
        : [],
    }
  }
  const problems: string[] = []
  for (const group of exclude) {
    if (!tokens.some((t) => covers(group, t.collection, t.name))) {
      problems.push(
        `build.semantics.exclude has "${group}", which matches nothing in ${semantics.file}. Was it renamed in Figma?`,
      )
    }
  }
  if (unnamed.length) {
    problems.push(
      `${unnamed.length} semantics have no code syntax and aren't excluded: ${list(unnamed.map((t) => `${t.collection}/${t.name}`))}. Name them with the plugin (build.semantics.codeSyntax), in Figma, or exclude them; then pull again.`,
    )
  }
  if (!config.build?.files.some((f) => f.format === 's58/scss/semantics')) {
    problems.push(
      "No file in build.files uses the 's58/scss/semantics' format, so the named semantics don't reach CSS.",
    )
  }
  return { problems, notes: [] }
}

export interface CheckResult {
  problems: string[]
  /** Things that pass but are worth seeing, such as accepted APCA misses. */
  notes: string[]
}

export async function checkTokens(
  config: TokensConfig,
  root = process.cwd(),
): Promise<CheckResult> {
  const apca = apcaMisses(config)
  const semantics = semanticsProblems(config, root)
  return {
    problems: [
      ...outOfDate([...dtcgFiles(config), ...(await builtFiles(config, root))], root),
      ...rawSemantics(config, root),
      ...apca.problems,
      ...manifestProblems(config, root),
      ...semantics.problems,
    ],
    notes: [...apca.accepted.map((f) => `Accepted APCA miss: ${f}`), ...semantics.notes],
  }
}
