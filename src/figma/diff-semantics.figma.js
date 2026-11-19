/**
 * Runs inside Figma (Plugin API), not in Node, next to `exportSemantics` (export-semantics.figma.js),
 * which it calls. It's inlined into the project's plugin, for the dry run, and into the use_figma
 * script from `s58-tokens figma script check`.
 *
 * It compares what Export would write now with the committed file, without carrying the file: the
 * spec holds a fingerprint of it (`diff.ts`), a short hash per token and one per collection's order.
 * It returns only what differs, so the result stays small enough for use_figma:
 * - `changed`: every entry Figma has that the file doesn't, with its value (added or changed);
 * - `missing`: the hash of every entry in the file that Figma doesn't have as it is (removed or
 *   changed). `applySemanticsDiff` in Node turns the hashes back into names;
 * - `order`: the token order of each collection whose order differs, and the collection order when
 *   that differs, so the pulled file comes out exactly as Export would write it.
 * An entry is a token, a collection's `$extensions` (its modes) or the file's `$extensions`.
 *
 * `hash` and `entries` must match their copies in diff.ts, byte for byte in what they produce.
 * test/semantic-diff.test.ts checks that they do.
 *
 * @param {{ ownedHashes: string[], collections?: string[], committed: { base: string, hashes: string[], order: Record<string, string>, collections: string, paths?: string[] } }} spec
 *   `committed` is the fingerprint. `paths`, when set (the plugin), names each hash, so the
 *   result can say what was removed and what changed. `ownedHashes` hashes the export's `owned`
 *   names (`<collection>\u0000<name>`), which would take half a use_figma script as text.
 */
export async function diffSemantics(spec) {
  // cyrb53: a fast 53-bit string hash, in base 36.
  function hash(text) {
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

  /** The file as entries, in order, and each collection's token paths. */
  function entries(tokens) {
    const out = []
    const order = {}
    for (const [name, collection] of Object.entries(tokens)) {
      if (name === '$extensions') {
        out.push({ path: ['$extensions'], value: collection })
        continue
      }
      out.push({ path: [name, '$extensions'], value: collection.$extensions ?? null })
      const paths = []
      const walk = (node, at) => {
        for (const [key, child] of Object.entries(node)) {
          if (key.startsWith('$')) continue
          if (child && typeof child === 'object' && '$value' in child) {
            out.push({ path: [name, ...at, key], value: child })
            paths.push([...at, key].join('/'))
          } else if (child && typeof child === 'object') walk(child, [...at, key])
        }
      }
      walk(collection, [])
      order[name] = paths
    }
    return { entries: out, order }
  }
  const hashOf = (entry) => hash(JSON.stringify([entry.path, entry.value]))

  const ownedHashes = new Set(spec.ownedHashes)
  const { tokens, report } = await exportSemantics(
    { owned: [], collections: spec.collections },
    (collection, name) => ownedHashes.has(hash(`${collection}\u0000${name}`)),
  )
  const now = entries(tokens)
  const committed = new Set(spec.committed.hashes)
  const seen = new Set()
  const changed = []
  for (const entry of now.entries) {
    // With --collections, the export has only those, and the file's own entry isn't compared.
    if (spec.collections && entry.path[0] === '$extensions') continue
    const h = hashOf(entry)
    if (committed.has(h)) seen.add(h)
    else changed.push(entry)
  }
  const missing = spec.committed.hashes.filter((h) => !seen.has(h))
  const order = { tokens: {} }
  for (const [name, paths] of Object.entries(now.order)) {
    if (spec.committed.order[name] !== hash(paths.join('\n'))) order.tokens[name] = paths
  }
  const names = Object.keys(now.order)
  if (!spec.collections && spec.committed.collections !== hash(names.join('\n'))) {
    order.collections = names
  }

  // A checksum of what Node applies, so a result copied by hand (an agent saving use_figma's
  // answer) is refused if anything in it changed on the way.
  const check = hash(JSON.stringify([changed, missing, order]))
  const result = { format: 1, base: spec.committed.base, check, changed, missing, order, report }
  // Names for the plugin's report: what was added, changed or removed.
  if (spec.committed.paths) {
    const pathOf = new Map(spec.committed.hashes.map((h, i) => [h, spec.committed.paths[i]]))
    const label = (path) => path.join('/')
    const gone = new Set(missing.map((h) => pathOf.get(h)))
    const summary = { added: [], changed: [], removed: [] }
    for (const entry of changed) {
      const name = label(entry.path)
      if (gone.has(name)) {
        summary.changed.push(name)
        gone.delete(name)
      } else summary.added.push(name)
    }
    summary.removed = [...gone]
    // Collections whose tokens only moved.
    const touched = (c) => [...summary.added, ...summary.removed].some((n) => n.startsWith(`${c}/`))
    summary.reordered = Object.keys(order.tokens).filter((c) => !touched(c))
    if (order.collections) summary.reordered.unshift('(the collections)')
    result.summary = summary
  }
  return result
}
