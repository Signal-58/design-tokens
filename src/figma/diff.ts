/**
 * Figma against the repository: what Export would change in the committed file
 * (`build.semantics.file`). Figma does the comparing (`diff-semantics.figma.js`) against a
 * fingerprint of the file, and returns only what differs, so it fits in a use_figma call even when
 * the file doesn't. The plugin's dry run shows it; `s58-tokens figma script check` gives the
 * script, and `s58-tokens figma diff|pull <result>` reads what it returns.
 *
 * `hash` and `entries` are the Node copies of the ones in diff-semantics.figma.js and must produce
 * the same; test/semantic-diff.test.ts checks that they do.
 */
import { figmaScript, type FileGuard } from './inline'
import { buildExportSpec, formatExport } from './semantics'
import type { VariablesSpec } from './variables'

type Tree = Record<string, unknown>

/** The committed file as Figma compares it: a hash per entry and per collection's token order. */
export interface SemanticsFingerprint {
  /** The hash of the file's text, so a result is only applied to the file it was made from. */
  base: string
  hashes: string[]
  /** Collection → the hash of its token paths, in order. */
  order: Record<string, string>
  /** The hash of the collection names, in order. */
  collections: string
  /** Each hash's entry, as `Collection/group/name` (or `Collection/$extensions`). The plugin only. */
  paths?: string[]
}

export interface DiffSpec {
  /** The hash of each code-owned `<collection>\u0000<name>`: the export's `owned`, smaller. */
  ownedHashes: string[]
  collections?: string[]
  committed: SemanticsFingerprint
}

/** An entry of the export: a token, a collection's `$extensions`, or the file's `$extensions`. */
interface Entry {
  path: string[]
  value: unknown
}

/** What the diff returns, from the plugin or use_figma. */
export interface SemanticsDiff {
  format: 1
  base: string
  /** In Figma and not in the file: added or changed. */
  changed: Entry[]
  /** Hashes of the file's entries that Figma doesn't have as they are: removed or changed. */
  missing: string[]
  order: { tokens: Record<string, string[]>; collections?: string[] }
  report: {
    collections: { name: string; variables: number }[]
    codeOwned: number
    warnings: string[]
  }
  summary?: DiffSummary
}

export interface DiffSummary {
  added: string[]
  changed: string[]
  removed: string[]
  /** Collections whose tokens only moved, and `(the collections)` when their order changed. */
  reordered: string[]
}

/** cyrb53: a fast 53-bit string hash, in base 36. The same as in diff-semantics.figma.js. */
export function hash(text: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const isToken = (value: unknown): value is Tree =>
  !!value && typeof value === 'object' && '$value' in value

/** The file as entries, in order, and each collection's token paths. Mirrors the Figma side. */
function entries(tokens: Tree): { entries: Entry[]; order: Record<string, string[]> } {
  const out: Entry[] = []
  const order: Record<string, string[]> = {}
  for (const [name, collection] of Object.entries(tokens)) {
    if (name === '$extensions') {
      out.push({ path: ['$extensions'], value: collection })
      continue
    }
    const c = collection as Tree
    out.push({ path: [name, '$extensions'], value: c.$extensions ?? null })
    const paths: string[] = []
    const walk = (node: Tree, at: string[]) => {
      for (const [key, child] of Object.entries(node)) {
        if (key.startsWith('$')) continue
        if (isToken(child)) {
          out.push({ path: [name, ...at, key], value: child })
          paths.push([...at, key].join('/'))
        } else if (child && typeof child === 'object') walk(child as Tree, [...at, key])
      }
    }
    walk(c, [])
    order[name] = paths
  }
  return { entries: out, order }
}

const hashOf = (entry: Entry) => hash(JSON.stringify([entry.path, entry.value]))

/** Only these collections of the file, when set. The file's own `$extensions` goes with them. */
function only(tokens: Tree, collections?: readonly string[]): Tree {
  if (!collections) return tokens
  return Object.fromEntries(Object.entries(tokens).filter(([name]) => collections.includes(name)))
}

/**
 * The fingerprint of the committed file (its text, as read from disk). `paths` names each hash,
 * for the plugin, which has room for them; a use_figma script leaves them out.
 */
export function fingerprint(
  text: string,
  options: { collections?: readonly string[]; paths?: boolean } = {},
): SemanticsFingerprint {
  const { entries: list, order } = entries(only(JSON.parse(text) as Tree, options.collections))
  const kept = options.collections ? list.filter((e) => e.path[0] !== '$extensions') : list
  return {
    base: hash(text),
    hashes: kept.map(hashOf),
    order: Object.fromEntries(
      Object.entries(order).map(([c, paths]) => [c, hash(paths.join('\n'))]),
    ),
    collections: hash(Object.keys(order).join('\n')),
    ...(options.paths ? { paths: kept.map((e) => e.path.join('/')) } : {}),
  }
}

/** The diff's spec: the export's, plus the fingerprint of the committed file. */
export function buildDiffSpec(
  variables: VariablesSpec,
  committed: string,
  options: { collections?: readonly string[]; paths?: boolean } = {},
): DiffSpec {
  const { owned, collections } = buildExportSpec(variables, options.collections)
  return {
    ownedHashes: owned.map(hash),
    ...(collections ? { collections } : {}),
    committed: fingerprint(committed, options),
  }
}

/**
 * The use_figma script for the check. It returns a `SemanticsDiff`: save it as JSON and run
 * `s58-tokens figma diff <file>` to read it, or `s58-tokens figma pull <file>` to apply it.
 */
export function buildDiffScript(spec: DiffSpec, guard: FileGuard): string {
  return figmaScript('diff-semantics.figma.js', 'diffSemantics', spec, false, guard, [
    'export-semantics.figma.js',
  ])
}

/**
 * Applies a diff to the committed file: the file Export would write now, and what changed. It
 * throws when the diff was made from another version of the file, or doesn't fit it.
 */
export function applySemanticsDiff(
  committed: string,
  diff: SemanticsDiff,
): { text: string; summary: DiffSummary } {
  if (diff.format !== 1) throw new Error(`Unknown diff format ${String(diff.format)}`)
  if (diff.base !== hash(committed)) {
    throw new Error(
      'The diff was made from another version of the committed file. Run the check again.',
    )
  }
  const tree = JSON.parse(committed) as Tree
  const before = entries(tree)
  const key = (path: string[]) => path.join('\u0000')
  const missing = new Set(diff.missing)
  const known = new Set(before.entries.map(hashOf))
  const unknown = diff.missing.filter((h) => !known.has(h))
  if (unknown.length) {
    throw new Error(`The diff names ${unknown.length} entries the committed file doesn't have.`)
  }

  // The file's entries, less those Figma no longer has as they are, plus what Figma has instead.
  const byKey = new Map<string, Entry>()
  const removed = new Set<string>()
  for (const entry of before.entries) {
    if (missing.has(hashOf(entry))) removed.add(key(entry.path))
    else byKey.set(key(entry.path), entry)
  }
  const summary: DiffSummary = { added: [], changed: [], removed: [], reordered: [] }
  for (const entry of diff.changed) {
    const k = key(entry.path)
    if (removed.delete(k)) summary.changed.push(entry.path.join('/'))
    else summary.added.push(entry.path.join('/'))
    byKey.set(k, entry)
  }
  summary.removed = [...removed].map((k) => k.split('\u0000').join('/'))

  // Rebuild in Export's order: the file's entry, then each collection's entry and its tokens.
  const names = diff.order.collections ?? [
    ...Object.keys(before.order),
    // A new collection always changes the order, so this is only a fallback.
    ...diff.changed.map((e) => e.path[0]).filter((n) => n !== '$extensions'),
  ]
  const out: Tree = {}
  const root = byKey.get(key(['$extensions']))
  if (root) out.$extensions = root.value
  const used = new Set<string>(root ? [key(['$extensions'])] : [])
  for (const name of new Set(names)) {
    // Figma sends a collection's order whenever it differs, so otherwise it's the file's, less
    // what Figma no longer has (a whole collection, when checking only some).
    const paths =
      diff.order.tokens[name] ??
      (before.order[name] ?? []).filter((p) => byKey.has(key([name, ...p.split('/')])))
    const head = byKey.get(key([name, '$extensions']))
    if (!head && !paths.length) continue
    const collection: Tree = {}
    if (head) {
      collection.$extensions = head.value
      used.add(key([name, '$extensions']))
    }
    for (const p of paths) {
      const path = [name, ...p.split('/')]
      const entry = byKey.get(key(path))
      if (!entry) throw new Error(`The diff orders ${path.join('/')}, which it doesn't have.`)
      let node = collection
      for (const part of path.slice(1, -1)) node = (node[part] ??= {}) as Tree
      node[path[path.length - 1]] = entry.value
      used.add(key(path))
    }
    out[name] = collection
  }
  const left = [...byKey.keys()].filter((k) => !used.has(k))
  if (left.length) {
    throw new Error(
      `The diff doesn't place ${left.length} entries (${left
        .slice(0, 3)
        .map((k) => k.split('\u0000').join('/'))
        .join(', ')}). Use the plugin's Export.`,
    )
  }

  for (const [name, paths] of Object.entries(diff.order.tokens)) {
    const touched = [...summary.added, ...summary.removed].some((n) => n.startsWith(`${name}/`))
    if (!touched && before.order[name] && paths.join('\n') !== before.order[name].join('\n'))
      summary.reordered.push(name)
  }
  if (diff.order.collections) summary.reordered.unshift('(the collections)')
  return { text: formatExport(out), summary }
}

/** The summary as text, for the CLI. */
export function describeDiff(summary: DiffSummary, warnings: readonly string[] = []): string {
  const total = summary.added.length + summary.changed.length + summary.removed.length
  const lines: string[] = []
  if (total === 0 && summary.reordered.length === 0) {
    lines.push('The committed file has everything Figma does. Nothing to pull.')
  } else {
    lines.push(`Figma has ${total} change${total === 1 ? '' : 's'} the committed file doesn't:`)
    for (const [title, names] of [
      ['Added', summary.added],
      ['Changed', summary.changed],
      ['Removed', summary.removed],
      ['Reordered', summary.reordered],
    ] as const) {
      if (names.length) lines.push(`  ${title}:`, ...names.map((n) => `    ${n}`))
    }
  }
  if (warnings.length) lines.push('Warnings:', ...warnings.map((w) => `  ${w}`))
  return `${lines.join('\n')}\n`
}
