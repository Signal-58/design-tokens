/**
 * Figma's own variable exports (File > Export > Variables, one file per mode) turned into DTCG that
 * sits next to the generated primitives:
 *
 * - A colour export goes under `color.<mode>`, so light and dark live in one tree. A colour Figma
 *   aliases to `primitive/colors/amber/6` becomes the reference `{primitive.colors.amber.6}`, which
 *   the generated palette defines. Figma's resolved values are dropped: in a Display P3 file they're
 *   P3 numbers labelled `srgb`.
 * - The Fluid tokens export goes under `fluid`, keeping only the semantic groups (Buttons, Forms…).
 *   The code-owned groups (Font size, Space size, the pairs) come from the generated tokens instead.
 *
 * References inside a file get the same prefix. Each token keeps its type and its code syntax.
 *
 * The pulled file (the plugin's Export, `pulledColourTokens` and `pulledFluidTokens`) gives the same
 * trees from one file that holds every collection and mode, with every alias as a reference.
 */
import { CODE_SYNTAX_EXTENSION, type DtcgTree } from './generate'

type Json = Record<string, unknown>

const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

function convert(node: Json, prefix: string): DtcgTree {
  const out: DtcgTree = {}
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || key.startsWith('com.') || !isRecord(value)) continue
    if (!('$value' in value)) {
      out[key] = convert(value, prefix)
      continue
    }
    const extensions = isRecord(value.$extensions) ? value.$extensions : {}
    const alias = isRecord(extensions['com.figma.aliasData'])
      ? extensions['com.figma.aliasData'].targetVariableName
      : undefined
    const raw = value.$value
    const $value =
      typeof raw === 'string' && /^\{.+\}$/.test(raw)
        ? `{${prefix}.${raw.slice(1, -1)}}`
        : typeof alias === 'string' && alias.startsWith('primitive/')
          ? `{${alias.split('/').join('.')}}`
          : raw
    const token: DtcgTree = { $type: value.$type as string, $value: $value as DtcgTree[string] }
    if (isRecord(extensions[CODE_SYNTAX_EXTENSION])) {
      token.$extensions = { [CODE_SYNTAX_EXTENSION]: extensions[CODE_SYNTAX_EXTENSION] as DtcgTree }
    }
    out[key] = token
  }
  return out
}

/** One mode of Figma's colour export, under `color.<mode>`. */
export function figmaColourTokens(json: Json, mode: string): DtcgTree {
  return { color: { [mode]: convert(json, `color.${mode}`) } }
}

/** The semantic groups of Figma's Fluid tokens export, in the order given, under `fluid`. */
export function figmaFluidTokens(json: Json, groups: readonly string[]): DtcgTree {
  const picked: Json = {}
  for (const group of groups) {
    if (!isRecord(json[group])) throw new Error(`The Fluid tokens export has no ${group} group`)
    picked[group] = json[group]
  }
  return { fluid: convert(picked, 'fluid') }
}

/**
 * One collection of the pulled file (the plugin's Export) at one mode, under `prefix`, in the same
 * shape Figma's own export gave: references to the same collection get the prefix, references to
 * `primitive/…` point at the generated primitives, and each token keeps its type and code syntax.
 * A reference to any other collection is an error, because nothing the build reads defines it.
 */
function convertPulled(
  node: Json,
  collection: string,
  mode: string,
  prefix: string,
  at: string[],
): DtcgTree {
  const out: DtcgTree = {}
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || !isRecord(value)) continue
    if (!('$value' in value)) {
      out[key] = convertPulled(value, collection, mode, prefix, [...at, key])
      continue
    }
    const where = [collection, ...at, key].join('.')
    const extensions = isRecord(value.$extensions) ? value.$extensions : {}
    const modes = isRecord(extensions['com.signal58.modes'])
      ? extensions['com.signal58.modes']
      : undefined
    if (modes && !(mode in modes))
      throw new Error(`${where} has no ${mode} mode in the pulled file`)
    const raw = modes ? modes[mode] : value.$value
    let $value = raw
    if (typeof raw === 'string' && /^\{.+\}$/.test(raw)) {
      const ref = raw.slice(1, -1)
      const rest = ref.split('.').slice(1)
      if (ref.startsWith(`${collection}.`))
        $value = `{${prefix}.${ref.slice(collection.length + 1)}}`
      else if (rest[0] === 'primitive') $value = `{${rest.join('.')}}`
      else {
        throw new Error(
          `${where} references ${raw}, which the build doesn't read. Point it at a primitive or at a semantic in ${collection}.`,
        )
      }
    }
    const token: DtcgTree = { $type: value.$type as string, $value: $value as DtcgTree[string] }
    if (isRecord(extensions[CODE_SYNTAX_EXTENSION])) {
      token.$extensions = { [CODE_SYNTAX_EXTENSION]: extensions[CODE_SYNTAX_EXTENSION] as DtcgTree }
    }
    out[key] = token
  }
  return out
}

function pulledCollection(json: Json, name: string): Json {
  const collection = json[name]
  if (!isRecord(collection)) throw new Error(`The pulled file has no ${name} collection`)
  return collection
}

/**
 * A colour collection of the pulled file, under `color.<mode>` for each output mode. `modes` maps
 * the output mode (`light`) to the Figma mode it reads (`Light`).
 */
export function pulledColourTokens(
  json: Json,
  collection: string,
  modes: Readonly<Record<string, string>>,
): DtcgTree {
  const source = pulledCollection(json, collection)
  return {
    color: Object.fromEntries(
      Object.entries(modes).map(([mode, figmaMode]) => [
        mode,
        convertPulled(source, collection, figmaMode, `color.${mode}`, []),
      ]),
    ),
  }
}

/** The semantic groups of the pulled Fluid tokens collection at one mode, in the order given, under `fluid`. */
export function pulledFluidTokens(
  json: Json,
  collection: string,
  mode: string,
  groups: readonly string[],
): DtcgTree {
  const source = pulledCollection(json, collection)
  const picked: Json = {}
  for (const group of groups) {
    if (!isRecord(source[group])) throw new Error(`The pulled ${collection} has no ${group} group`)
    picked[group] = source[group]
  }
  return { fluid: convertPulled(picked, collection, mode, 'fluid', []) }
}

/** Merges DTCG trees, group by group. A token defined twice is an error. */
export function mergeTrees(...trees: DtcgTree[]): DtcgTree {
  const out: DtcgTree = {}
  const merge = (into: DtcgTree, from: DtcgTree, path: string[]) => {
    for (const [key, value] of Object.entries(from)) {
      const existing = into[key]
      if (existing === undefined) {
        into[key] = value
      } else if (
        isRecord(existing) &&
        isRecord(value) &&
        !('$value' in existing) &&
        !('$value' in value)
      ) {
        merge(existing as DtcgTree, value as DtcgTree, [...path, key])
      } else {
        throw new Error(`Two token sources define ${[...path, key].join('.')}`)
      }
    }
  }
  for (const tree of trees) merge(out, structuredClone(tree), [])
  return out
}
