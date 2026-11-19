/**
 * Runs inside Figma (Plugin API), not in Node. It's inlined, with `export ` removed, into the
 * project's plugin and into the use_figma script, with the spec from semantics.ts.
 *
 * It reads the variables Figma owns and returns them as one DTCG tree, the pulled file the build
 * reads (`design-tokens/figma/semantics.tokens.json`):
 * - tokens nest by collection, then by the variable's name (`Colours` › `Typography` › `level-1`);
 * - an alias stays a reference, by collection and name: `{Primitives.primitive.colors.amber.6}`;
 * - every mode's value is in `$extensions['com.signal58.modes']`, and `$value` is the first mode's;
 * - code syntax, scopes, descriptions and the hidden flag come too, but no variable ids, so the
 *   file only changes when the tokens do;
 * - raw colours are written in the file's colour profile (`display-p3` in a P3 file), never as P3
 *   numbers labelled `srgb`, which is what Figma's own export does.
 *
 * Variables the plugin writes from code (spec.owned) are left out: code owns them, and references
 * to them stay. It reads only; nothing in the file changes.
 *
 * @param {{ owned: string[], collections?: string[] }} spec `owned` holds `<collection>\u0000<name>`
 *   for each code-owned variable; `collections`, when set, limits the export to those collections.
 * @returns {Promise<{ tokens: object, report: { collections: { name: string, variables: number }[], codeOwned: number, warnings: string[] } }>}
 */
export async function exportSemantics(spec) {
  const report = { collections: [], codeOwned: 0, warnings: [] }
  const owned = new Set(spec.owned)
  const only = spec.collections ? new Set(spec.collections) : null
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const variables = await figma.variables.getLocalVariablesAsync()
  const variableById = new Map(variables.map((v) => [v.id, v]))
  const collectionById = new Map(collections.map((c) => [c.id, c]))
  const TYPES = { COLOR: 'color', FLOAT: 'number', STRING: 'string', BOOLEAN: 'boolean' }
  const profile = figma.root.documentColorProfile
  const colorSpace = profile === 'DISPLAY_P3' ? 'display-p3' : 'srgb'
  const round = (n, places) => Math.round(n * 10 ** places) / 10 ** places
  // DTCG paths are dot-separated and references are braced, so these can't be in a name.
  const unusable = (part) => /[.{}]/.test(part) || part.startsWith('$') || part === ''

  if (only) {
    const missing = [...only].filter((name) => !collections.some((c) => c.name === name))
    if (missing.length) report.warnings.push(`No collection called ${missing.join(', ')}`)
  }

  /** `{Collection.Group.name}` for a variable, local or from a library; null when it's gone. */
  async function reference(id) {
    let variable = variableById.get(id)
    let collection = variable && collectionById.get(variable.variableCollectionId)
    if (!variable) {
      variable = await figma.variables.getVariableByIdAsync(id)
      collection =
        variable &&
        (await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId))
    }
    if (!variable || !collection) return null
    return `{${[collection.name, ...variable.name.split('/')].join('.')}}`
  }

  async function valueOf(variable, raw) {
    if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') {
      const ref = await reference(raw.id)
      if (ref) return ref
      const warning = `${variable.name} aliases a variable that isn't in this file or its libraries`
      // Once per variable, not once per mode.
      if (!report.warnings.includes(warning)) report.warnings.push(warning)
      return '{(missing)}'
    }
    if (variable.resolvedType === 'COLOR') {
      const { r, g, b, a = 1 } = raw
      return { colorSpace, components: [r, g, b].map((n) => round(n, 5)), alpha: round(a, 4) }
    }
    if (variable.resolvedType === 'FLOAT') return round(raw, 4)
    return raw
  }

  const tokens = {}
  for (const collection of collections) {
    if (only && !only.has(collection.name)) continue
    const tree = {}
    let count = 0
    const defaultMode = collection.modes.find((m) => m.modeId === collection.defaultModeId)
    for (const id of collection.variableIds) {
      const variable = variableById.get(id)
      if (!variable) continue
      if (owned.has(`${collection.name}\u0000${variable.name}`)) {
        report.codeOwned++
        continue
      }
      const path = variable.name.split('/')
      if (path.some(unusable)) {
        report.warnings.push(
          `${collection.name}: ${variable.name} has a name the export can't write (no dots, braces, empty parts or a leading $), so it was left out`,
        )
        continue
      }
      let node = tree
      let clash = false
      for (const part of path.slice(0, -1)) {
        if (node[part] && '$value' in node[part]) clash = true
        node = node[part] ??= {}
      }
      const leaf = path[path.length - 1]
      if (clash || node[leaf]) {
        report.warnings.push(
          `${collection.name}: ${variable.name} clashes with another variable's name, so it was left out`,
        )
        continue
      }
      const modes = {}
      for (const mode of collection.modes) {
        modes[mode.name] = await valueOf(variable, variable.valuesByMode[mode.modeId])
      }
      const extensions = {}
      if (variable.codeSyntax && variable.codeSyntax.WEB) {
        extensions['com.figma.codeSyntax'] = { WEB: variable.codeSyntax.WEB }
      }
      extensions['com.figma.scopes'] = [...variable.scopes]
      if (variable.hiddenFromPublishing) extensions['com.figma.hiddenFromPublishing'] = true
      if (collection.modes.length > 1) extensions['com.signal58.modes'] = modes
      const token = {
        $type: TYPES[variable.resolvedType],
        $value: modes[(defaultMode || collection.modes[0]).name],
      }
      if (variable.description) token.$description = variable.description
      token.$extensions = extensions
      node[leaf] = token
      count++
    }
    if (!count) continue
    tokens[collection.name] = {
      $extensions: {
        'com.signal58.collection': {
          modes: collection.modes.map((m) => m.name),
          defaultMode: (defaultMode || collection.modes[0]).name,
        },
      },
      ...tree,
    }
    report.collections.push({ name: collection.name, variables: count })
  }
  return {
    tokens: {
      $extensions: { 'com.signal58.export': { format: 1, colorProfile: profile } },
      ...tokens,
    },
    report,
  }
}
