/**
 * Every semantic in the pulled file that `colours` and `fluid` don't already read, as DTCG under
 * `semantic.<collection>`, so the `s58/scss/semantics` format can write it. Plus the code-owned
 * variables those semantics alias that the generated tokens don't hold (the Utopia steps by
 * viewport, `Space @min/S`), under `owned.<collection>`, as plain numbers.
 *
 * Each semantic keeps every mode's value (`com.signal58.modes`) as a reference into this tree:
 * - to a semantic in the pulled file: `{semantic.<collection>.…}`, or `{fluid.…}` for the fluid
 *   groups `fluid.groups` lists, which `pulledFluidTokens` adds;
 * - to a code-owned fluid token: `{fluid.…}` (the generated `fluid.tokens.json`);
 * - to a palette primitive: `{primitive.…}`;
 * - to another code-owned variable: `{owned.<collection>.…}`.
 *
 * Excluded tokens (`exclude`) stay in the tree without code syntax, so references through them
 * still resolve. A reference to anything else (a library variable, say) stops the build, unless
 * the token is excluded and nothing included resolves through it.
 */
import type { PulledSemantics } from '../style-dictionary'
import type { DtcgTree } from '../dtcg/generate'
import { CODE_SYNTAX_EXTENSION } from '../dtcg/generate'
import type { VariablesSpec } from '../figma/variables'
import { isExcluded } from './rules'

type Json = Record<string, unknown>
const isRecord = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

export const MODES_EXTENSION = 'com.signal58.modes'
export const SCOPES_EXTENSION = 'com.figma.scopes'
/** On a token whose alias the build can't follow: the reference, for the error if anything needs it. */
export const UNRESOLVED_EXTENSION = 'com.signal58.unresolved'
/** On each semantic token: its collection's modes, in order, and the default. */
export const COLLECTION_EXTENSION = 'com.signal58.collection'

/** The token at `path` in a pulled collection, or undefined. */
function tokenAt(json: Json, collection: string, path: string[]): Json | undefined {
  let node: unknown = json[collection]
  for (const part of path) {
    if (!isRecord(node)) return undefined
    node = node[part]
  }
  return isRecord(node) && '$value' in node ? node : undefined
}

/** Calls `visit` for every token under `node`, with its path. */
function eachToken(node: Json, visit: (path: string[], token: Json) => void, at: string[] = []) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || !isRecord(value)) continue
    if ('$value' in value) visit([...at, key], value)
    else eachToken(value, visit, [...at, key])
  }
}

function setAt(tree: DtcgTree, path: string[], token: DtcgTree) {
  let node = tree
  for (const part of path.slice(0, -1)) node = (node[part] ??= {}) as DtcgTree
  node[path[path.length - 1]] = token
}

/** The code-owned variables outside the palette and fluid collections, by collection and name. */
function ownedVariables(
  spec: VariablesSpec,
  skip: readonly string[],
): Map<string, Map<string, number | string>> {
  const out = new Map<string, Map<string, number | string>>()
  for (const collection of spec.collections) {
    if (skip.includes(collection.name)) continue
    const names = new Map<string, number | string>()
    for (const v of collection.variables) {
      if ('value' in v && typeof v.value === 'number') names.set(v.name, v.value)
      else if ('aliasOf' in v)
        names.set(v.name, `{owned.${collection.name}.${v.aliasOf.split('/').join('.')}}`)
    }
    out.set(collection.name, names)
  }
  return out
}

/**
 * The `semantic` and `owned` trees. `paletteCollection` is the collection the palette primitives
 * live in, and `fluidCollection` the one the generated fluid tokens do: both are already in the
 * generated tokens.
 */
export function semanticTree(
  json: Json,
  semantics: PulledSemantics,
  spec: VariablesSpec,
  paletteCollection: string,
  fluidCollection: string,
): DtcgTree {
  const exclude = semantics.exclude ?? []
  const colourCollection = semantics.colours?.collection
  const fluidGroups = semantics.fluid?.groups ?? []
  const owned = ownedVariables(spec, [paletteCollection, fluidCollection])
  const collections = [
    ...new Set([...Object.keys(json).filter((k) => !k.startsWith('$')), ...owned.keys()]),
  ].sort((a, b) => b.length - a.length)

  /** A pulled reference (`{Fluid tokens.Space size pairs.L—XL}`) as one into this tree, or null. */
  function convert(raw: string): string | null {
    const ref = raw.slice(1, -1)
    const collection = collections.find((c) => ref.startsWith(`${c}.`))
    if (!collection) return null
    const rest = ref.slice(collection.length + 1)
    const path = rest.split('.')
    if (collection !== colourCollection && tokenAt(json, collection, path)) {
      return collection === fluidCollection && fluidGroups.includes(path[0])
        ? `{fluid.${rest}}`
        : `{semantic.${collection}.${rest}}`
    }
    if (collection === fluidCollection) return `{fluid.${rest}}`
    if (path[0] === 'primitive') return `{${rest}}`
    if (owned.get(collection)?.has(path.join('/'))) return `{owned.${collection}.${rest}}`
    return null
  }

  const tree: DtcgTree = {}
  for (const [collection, node] of Object.entries(json)) {
    if (collection.startsWith('$') || !isRecord(node) || collection === colourCollection) continue
    const info = isRecord(node.$extensions) ? node.$extensions[COLLECTION_EXTENSION] : undefined
    const group: DtcgTree = {}
    eachToken(node, (path, token) => {
      // The fluid groups `fluid` reads are already in the tree, under `fluid`.
      if (collection === fluidCollection && fluidGroups.includes(path[0])) return
      if (token.$type === 'color') return
      const name = path.join('/')
      const extensions = isRecord(token.$extensions) ? token.$extensions : {}
      const modes = isRecord(extensions[MODES_EXTENSION])
        ? extensions[MODES_EXTENSION]
        : {
            [isRecord(info) && typeof info.defaultMode === 'string' ? info.defaultMode : 'default']:
              token.$value,
          }
      const excluded = isExcluded(exclude, collection, name)
      const converted: Record<string, unknown> = {}
      let unresolved: string | undefined
      for (const [mode, value] of Object.entries(modes)) {
        if (typeof value === 'string' && /^\{.+\}$/.test(value)) {
          const ref = convert(value)
          if (ref) converted[mode] = ref
          else {
            unresolved = value
            converted[mode] = 0
          }
        } else converted[mode] = value
      }
      if (unresolved && !excluded) {
        throw new Error(
          `${collection}: ${name} references ${unresolved}, which isn't in the pulled file or the configs (a library variable?). Fix the alias in Figma, or exclude the token (build.semantics.exclude).`,
        )
      }
      const first = Object.values(converted)[0]
      const out: DtcgTree = {
        $type: String(token.$type),
        // Style Dictionary resolves `$value`; the format reads the modes.
        $value: first as DtcgTree[string],
        $extensions: {
          [MODES_EXTENSION]: converted as DtcgTree,
          [SCOPES_EXTENSION]: (extensions[SCOPES_EXTENSION] ?? []) as DtcgTree[string],
          // Style Dictionary keeps token extensions but not group ones, so each token carries it.
          ...(isRecord(info) ? { [COLLECTION_EXTENSION]: info as DtcgTree } : {}),
          // Without braces: Style Dictionary resolves references in extensions too.
          ...(unresolved ? { [UNRESOLVED_EXTENSION]: unresolved.slice(1, -1) } : {}),
          ...(!excluded && isRecord(extensions[CODE_SYNTAX_EXTENSION])
            ? { [CODE_SYNTAX_EXTENSION]: extensions[CODE_SYNTAX_EXTENSION] as DtcgTree }
            : {}),
        },
      }
      setAt(group, path, out)
    })
    if (Object.keys(group).length) tree[collection] = group
  }

  const ownedTree: DtcgTree = {}
  for (const [collection, names] of owned) {
    for (const [name, value] of names) {
      setAt(ownedTree, [collection, ...name.split('/')], { $type: 'number', $value: value })
    }
  }
  return { semantic: tree, owned: ownedTree }
}

/**
 * Removes code syntax from the excluded tokens of a converted tree (`color.<mode>` or `fluid`),
 * so no format writes them. `strip` is how many leading path parts aren't the token's name
 * (2 for `color.light`, 1 for `fluid`).
 */
export function stripExcluded(
  tree: DtcgTree,
  collection: string,
  exclude: readonly string[],
  strip: number,
): DtcgTree {
  if (!exclude.length) return tree
  const walk = (node: DtcgTree, at: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('$') || !isRecord(value)) continue
      const path = [...at, key]
      if ('$value' in value) {
        const name = path.slice(strip).join('/')
        const ext = value.$extensions as DtcgTree | undefined
        if (ext && isExcluded(exclude, collection, name)) delete ext[CODE_SYNTAX_EXTENSION]
      } else walk(value as DtcgTree, path)
    }
  }
  walk(tree, [])
  return tree
}
