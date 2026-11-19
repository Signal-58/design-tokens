/**
 * Runs inside Figma (Plugin API), not in Node. It's inlined, with `export ` removed, into the
 * project's plugin and into the use_figma script, with the spec from code-syntax.ts.
 *
 * It names the semantics Figma owns that have no code syntax, by the project's rules
 * (`build.semantics.codeSyntax`), so they reach code (src/semantics/rules.ts says how):
 * - only variables with no WEB code syntax change; a name a designer set stays;
 * - code-owned variables (spec.owned) and excluded ones (spec.exclude) are left alone;
 * - a name already used by another variable, or given twice, is reported and not written;
 * - variables no rule covers are listed, because they won't reach code.
 *
 * With dryRun it changes nothing and reports what it would do.
 *
 * @param {{ owned: string[], exclude: string[], rules: Record<string, string> }} spec
 * @param {boolean} dryRun Report only.
 */
export async function applyCodeSyntax(spec, dryRun) {
  const report = { dryRun, named: [], unnamed: [], designOnly: 0, unchanged: 0, warnings: [] }
  const owned = new Set(spec.owned)
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const variables = await figma.variables.getLocalVariablesAsync()
  const collectionName = new Map(collections.map((c) => [c.id, c.name]))
  const partsOf = (path) => path.split('/').filter(Boolean)
  const covers = (group, collection, name) => {
    const g = partsOf(group)
    const t = [collection, ...partsOf(name)]
    return g.length <= t.length && g.every((part, i) => part === t[i])
  }
  const kebab = (text) =>
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  const nameFor = (collection, name) => {
    let best = null
    for (const [group, prefix] of Object.entries(spec.rules)) {
      if (!covers(group, collection, name)) continue
      if (!best || partsOf(group).length > partsOf(best.group).length) best = { group, prefix }
    }
    if (!best) return null
    const rest = [collection, ...partsOf(name)].slice(partsOf(best.group).length)
    return [kebab(best.prefix), ...rest.map(kebab)].filter(Boolean).join('-')
  }

  // Every name in use, so a new one never repeats another variable's.
  const taken = new Map()
  for (const v of variables) {
    if (v.codeSyntax && v.codeSyntax.WEB) taken.set(v.codeSyntax.WEB, v.name)
  }
  for (const variable of variables) {
    const collection = collectionName.get(variable.variableCollectionId)
    if (!collection || owned.has(`${collection}\u0000${variable.name}`)) continue
    if (spec.exclude.some((group) => covers(group, collection, variable.name))) {
      report.designOnly++
      continue
    }
    if (variable.codeSyntax && variable.codeSyntax.WEB) {
      report.unchanged++
      continue
    }
    const name = nameFor(collection, variable.name)
    const where = `${collection}: ${variable.name}`
    if (!name) {
      report.unnamed.push(where)
      continue
    }
    if (taken.has(name)) {
      report.warnings.push(
        `${where} would be ${name}, which ${taken.get(name)} already has, so it was left unnamed`,
      )
      continue
    }
    taken.set(name, variable.name)
    report.named.push({ name: where, to: name })
    if (!dryRun) variable.setVariableCodeSyntax('WEB', name)
  }
  return report
}
