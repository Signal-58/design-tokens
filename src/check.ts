/**
 * `s58-tokens check`: read only, for CI. It reports:
 *
 * - generated files that don't match the configs (someone edited a config or a Figma export and
 *   didn't rebuild, or edited a generated file by hand);
 * - semantic tokens with code syntax whose value is raw instead of a reference: semantics point
 *   only at primitives or at other semantics;
 * - APCA floors a generated scale misses, unless the config accepts that miss;
 * - a plugin manifest whose name or id doesn't match the config, or that doesn't give the plugin
 *   the file's key for the file guard (`enablePrivatePluginApi`).
 */
import fs from 'node:fs'
import path from 'node:path'

import type { TokensConfig } from './config'
import { builtFiles, dtcgFiles, type OutputFile } from './outputs'
import { generatedApcaFailures } from './palette/report'
import { tokenTree } from './style-dictionary'

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
  for (const group of config.build?.semantics?.fluid?.groups ?? []) {
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
  return {
    problems: [
      ...outOfDate([...dtcgFiles(config), ...(await builtFiles(config, root))], root),
      ...rawSemantics(config, root),
      ...apca.problems,
      ...manifestProblems(config, root),
    ],
    notes: apca.accepted.map((f) => `Accepted APCA miss: ${f}`),
  }
}
