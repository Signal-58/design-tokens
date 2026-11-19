/**
 * Runs inside Figma (Plugin API), not in Node. It's inlined, with `export ` removed, into the
 * project's plugin and into the use_figma script, with the spec from colour-scopes.ts.
 *
 * It sets the scopes of colour variables Figma owns, such as the semantic colours, by rule:
 * - a rule covers every colour variable under its group in its collection, or the one variable
 *   whose name is the group; when rules overlap, the most specific group wins;
 * - only scopes change: it never creates, renames or deletes a variable, or changes a value or alias;
 * - a rule whose collection or group matches nothing is reported, so a renamed group shows up.
 *
 * With dryRun it changes nothing and reports what it would do.
 *
 * @param {{ rules: { collection: string, group: string, scopes: string[] }[] }} spec
 * @param {boolean} dryRun Report only.
 */
export async function applyColourScopes(spec, dryRun) {
  const report = { dryRun, updated: [], unchanged: 0, warnings: [] }
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const variables = await figma.variables.getLocalVariablesAsync('COLOR')
  const covers = (group, name) => name === group || name.startsWith(`${group}/`)
  const sameScopes = (a, b) => a.length === b.length && a.every((s) => b.includes(s))
  const show = (scopes) => (scopes.length ? scopes.join(', ') : 'none')

  const matched = new Set()
  for (const variable of variables) {
    const collection = collections.find((c) => c.id === variable.variableCollectionId)
    if (!collection) continue
    // The most specific rule for this variable: the longest group that covers it.
    let rule = null
    for (const r of spec.rules) {
      if (r.collection !== collection.name || !covers(r.group, variable.name)) continue
      matched.add(r)
      if (!rule || r.group.length > rule.group.length) rule = r
    }
    if (!rule) continue
    if (sameScopes(variable.scopes, rule.scopes)) {
      report.unchanged++
      continue
    }
    report.updated.push({
      name: `${collection.name}: ${variable.name}`,
      from: show(variable.scopes),
      to: show(rule.scopes),
    })
    if (!dryRun) variable.scopes = rule.scopes
  }

  for (const rule of spec.rules) {
    if (matched.has(rule)) continue
    const where = collections.some((c) => c.name === rule.collection)
      ? `no colour variable under "${rule.group}" in "${rule.collection}"`
      : `no variable collection named "${rule.collection}"`
    report.warnings.push(`Colour scopes for ${rule.collection} / ${rule.group}: ${where}.`)
  }
  return report
}
