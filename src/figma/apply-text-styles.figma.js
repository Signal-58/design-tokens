/**
 * Runs inside Figma (Plugin API), not in Node. build.ts inlines this function,
 * with `export ` removed, into the local plugin's code.js and into the script for the Figma MCP's
 * use_figma tool, each with the spec built from design-tokens/typography.config.ts.
 *
 * It only touches what the spec names:
 * - the font family and weight variables listed in the spec (default mode only), created with
 *   their collection when missing, so it works on a blank file
 * - text styles named `<group>/Step <n>` for each role in the spec
 * Styles in a role's group that the spec doesn't list are reported as orphans, never deleted.
 *
 * The MCP runs in Figma's cloud, which can't load fonts installed only on a designer's computer
 * (Futura Std, Nudica). Figma lets a style be bound to a font variable without loading the font,
 * but not edited afterwards. So each style is written in a placeholder font that is always
 * available, and the font variables are bound last.
 *
 * With dryRun it changes nothing and reports what it would do.
 *
 * @param {object} spec The spec from buildTextStyleSpec().
 * @param {boolean} dryRun Report only.
 * @param {string[]} planned Variables the variables module creates earlier in the same run, as
 *   "collection\u0000name". The plugin passes them, so its dry run works on a blank file.
 */
export async function applyTextStyles(spec, dryRun, planned = []) {
  const PLACEHOLDER_FAMILY = 'Inter'
  const report = {
    dryRun,
    variables: [],
    created: [],
    updated: [],
    unchanged: [],
    orphans: [],
    warnings: [],
    styleIds: {},
  }
  const near = (a, b) => Math.abs(a - b) < 0.001
  // Whether a style's plain line height, letter spacing or paragraph spacing already matches.
  // Zero letter spacing is the same in px or %.
  const samePlain = (field, have, want) => {
    if (field === 'paragraphSpacing') return near(have, want)
    if (field === 'letterSpacing' && near(have.value, 0) && near(want.value, 0)) return true
    if (have.unit !== want.unit) return false
    return have.unit === 'AUTO' || near(have.value, want.value)
  }
  const fontKey = (font) => `${font.family} ${font.style}`
  // Figma stores descriptions HTML-escaped ("&quot;" for a double quote).
  const decodeEntities = (s) =>
    String(s)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
  const loadedFonts = new Set()
  // How to write a style in `family weight`. The style's plain values can only be edited in a font
  // this environment can load, and binding the font variables one at a time passes through an
  // intermediate font that Figma must also accept (loaded, or used by an existing style). So:
  // - the real font, when it can be loaded (Figma desktop with the font installed);
  // - else a loadable font in the same weight (Inter first), then bind weight, then family;
  // - else a loadable font in a weight the target family already uses in this file, then bind
  //   family, then weight.
  const editPlan = async (family, weight) => {
    const byPreference = (fonts) => [
      ...fonts.filter((f) => f.family === PLACEHOLDER_FAMILY),
      ...fonts.filter((f) => f.family !== PLACEHOLDER_FAMILY),
    ]
    let plan
    if (loadable.has(fontKey({ family, style: weight }))) {
      plan = { font: { family, style: weight }, weightFirst: true }
    } else {
      const sameWeight = byPreference(available).find((f) => f.style === weight)
      if (sameWeight) plan = { font: sameWeight, weightFirst: true }
      else {
        const familyStyles = new Set(
          [...known]
            .filter((k) => k.startsWith(`${family} `))
            .map((k) => k.slice(family.length + 1)),
        )
        const bridge = byPreference(available).find((f) => familyStyles.has(f.style))
        if (bridge) plan = { font: bridge, weightFirst: false }
      }
    }
    if (!plan) throw new Error(`No font available here to write "${family} ${weight}" with`)
    if (!loadedFonts.has(fontKey(plan.font))) {
      await figma.loadFontAsync(plan.font)
      loadedFonts.add(fontKey(plan.font))
    }
    return plan
  }

  // Variables
  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const collectionNamed = (name) => {
    const collection = collections.find((c) => c.name === name)
    if (!collection) throw new Error(`No variable collection named "${name}"`)
    return collection
  }
  // The font collection and its variables are created when missing, so the module works on a
  // blank file. In a dry run they're stand-ins with no id that Figma knows.
  let fontCollection = collections.find((c) => c.name === spec.figma.fontCollection)
  if (!fontCollection) {
    report.variables.push({ name: spec.figma.fontCollection, from: 'none', to: 'new collection' })
    fontCollection = dryRun
      ? { id: '(new collection)', name: spec.figma.fontCollection, modes: [], defaultModeId: null }
      : figma.variables.createVariableCollection(spec.figma.fontCollection)
  }
  // The size collection and its variables come from the variables module, which the plugin runs
  // first. A dry run of the whole plugin on a blank file runs before they exist, so a dry run counts
  // a missing one as there when `planned` (the variables module's spec, as "collection\u0000name")
  // says that module creates it. Anything else missing still stops the run.
  const plannedVariables = new Set(planned)
  const isPlanned = (collection, name) =>
    dryRun && plannedVariables.has(`${collection}\u0000${name}`)
  let sizeCollection = collections.find((c) => c.name === spec.figma.sizeCollection)
  if (!sizeCollection) {
    const name = spec.figma.sizeCollection
    if (!(dryRun && planned.some((k) => k.startsWith(`${name}\u0000`)))) collectionNamed(name)
    sizeCollection = { id: '(planned collection)', name }
  }
  const allVariables = [...(await figma.variables.getLocalVariablesAsync())]
  const variableNamed = (collection, name) => {
    const variable = allVariables.find(
      (v) => v.variableCollectionId === collection.id && v.name === name,
    )
    if (variable) return variable
    if (isPlanned(collection.name, name)) {
      return { id: `(planned) ${name}`, name, variableCollectionId: collection.id }
    }
    throw new Error(`No variable "${name}" in "${collection.name}"`)
  }

  if (fontCollection.modes.length > 1) {
    report.warnings.push(
      `"${fontCollection.name}" has ${fontCollection.modes.length} modes; only the default mode is set from the config.`,
    )
  }

  // Font family and weight values for the default mode. Written only after the checks below.
  const fontValues = {}
  const variableWrites = []
  for (const entry of spec.fontVariables) {
    const exists = allVariables.some(
      (v) => v.variableCollectionId === fontCollection.id && v.name === entry.variable,
    )
    if (!exists) {
      report.variables.push({ name: entry.variable, from: 'none', to: entry.value })
      fontValues[entry.variable] = entry.value
      if (dryRun) {
        allVariables.push({
          id: `(new) ${entry.variable}`,
          name: entry.variable,
          variableCollectionId: fontCollection.id,
        })
        continue
      }
      const created = figma.variables.createVariable(entry.variable, fontCollection, 'STRING')
      created.scopes = [entry.kind === 'weight' ? 'FONT_STYLE' : 'FONT_FAMILY']
      created.setValueForMode(fontCollection.defaultModeId, entry.value)
      allVariables.push(created)
      continue
    }
    const variable = variableNamed(fontCollection, entry.variable)
    const current = variable.valuesByMode[fontCollection.defaultModeId]
    if (typeof current === 'object' && current !== null) {
      report.warnings.push(`${entry.variable} is an alias; left unchanged.`)
      continue
    }
    fontValues[entry.variable] = entry.value
    if (current !== entry.value) {
      report.variables.push({ name: entry.variable, from: current, to: entry.value })
      variableWrites.push({ variable, value: entry.value })
    }
  }

  const localStyles = await figma.getLocalTextStylesAsync()

  // A font counts as real if Figma can load it here or an existing style already uses it.
  // Anything else is reported, because a wrong weight name ("Regular" for "Book") shows as a
  // missing font on designers' machines.
  const available = (await figma.listAvailableFontsAsync()).map((f) => f.fontName)
  const loadable = new Set(available.map(fontKey))
  const known = new Set(loadable)
  for (const s of localStyles) known.add(fontKey(s.fontName))
  const unverified = new Set()
  for (const want of spec.styles) {
    const key = fontKey({
      family: fontValues[want.familyVariable],
      style: fontValues[want.weightVariable],
    })
    if (!known.has(key)) unverified.add(key)
  }
  for (const key of unverified) {
    report.warnings.push(
      `"${key}" isn't used by any style and can't be loaded here. Check the family and weight names in design-tokens/typography.config.ts.`,
    )
  }

  if (!dryRun) {
    for (const { variable, value } of variableWrites) {
      variable.setValueForMode(fontCollection.defaultModeId, value)
    }
  }

  // Text styles
  const specNames = new Set(spec.styles.map((s) => s.name))
  for (const group of spec.groups) {
    for (const s of localStyles) {
      if (s.name.startsWith(`${group}/`) && !specNames.has(s.name)) {
        report.orphans.push({ id: s.id, name: s.name })
      }
    }
  }

  for (const want of spec.styles) {
    const familyVariable = variableNamed(fontCollection, want.familyVariable)
    const weightVariable = variableNamed(fontCollection, want.weightVariable)
    const sizeVariable = variableNamed(sizeCollection, want.sizeVariable)
    // Line height, letter spacing and paragraph spacing: a plain value, or a variable to bind.
    const isBound = (v) => typeof v === 'object' && v !== null
    const spacing = {
      lineHeight: isBound(want.lineHeight)
        ? variableNamed(sizeCollection, want.lineHeight.variable)
        : want.lineHeight === 'auto'
          ? { unit: 'AUTO' }
          : { unit: 'PERCENT', value: want.lineHeight },
      letterSpacing: isBound(want.letterSpacing)
        ? variableNamed(sizeCollection, want.letterSpacing.variable)
        : { unit: 'PERCENT', value: want.letterSpacing },
      paragraphSpacing: isBound(want.paragraphSpacing)
        ? variableNamed(sizeCollection, want.paragraphSpacing.variable)
        : want.paragraphSpacing,
    }
    const toBind = (field) => isBound(want[field])

    const existing = localStyles.find((s) => s.name === want.name)
    const bound = (existing && existing.boundVariables) || {}
    const changes = []
    if (!existing) changes.push('new')
    else {
      if (decodeEntities(existing.description) !== want.description) changes.push('description')
      if (!bound.fontFamily || bound.fontFamily.id !== familyVariable.id) changes.push('fontFamily')
      if (!bound.fontStyle || bound.fontStyle.id !== weightVariable.id) changes.push('fontStyle')
      if (!bound.fontSize || bound.fontSize.id !== sizeVariable.id) changes.push('fontSize')
      for (const field of ['lineHeight', 'letterSpacing', 'paragraphSpacing']) {
        if (toBind(field)) {
          if (!bound[field] || bound[field].id !== spacing[field].id) changes.push(field)
        } else if (bound[field] || !samePlain(field, existing[field], spacing[field])) {
          changes.push(field)
        }
      }
    }

    if (!changes.length) {
      report.unchanged.push(want.name)
      report.styleIds[want.name] = existing.id
      continue
    }
    if (existing) report.updated.push({ name: want.name, changes })
    else report.created.push(want.name)
    if (dryRun) continue

    const style = existing || figma.createTextStyle()
    // Unbind, switch to a font that can be edited here (editPlan), bind the size and set or bind
    // the spacing values, then bind weight and family. The font bindings decide the final font.
    for (const field of [
      'fontFamily',
      'fontStyle',
      'fontSize',
      'lineHeight',
      'letterSpacing',
      'paragraphSpacing',
    ]) {
      if (style.boundVariables && style.boundVariables[field]) style.setBoundVariable(field, null)
    }
    const plan = await editPlan(fontValues[want.familyVariable], fontValues[want.weightVariable])
    style.fontName = plan.font
    style.name = want.name
    style.description = want.description
    style.setBoundVariable('fontSize', sizeVariable)
    for (const field of ['lineHeight', 'letterSpacing', 'paragraphSpacing']) {
      if (toBind(field)) style.setBoundVariable(field, spacing[field])
      else style[field] = spacing[field]
    }
    if (plan.weightFirst) {
      style.setBoundVariable('fontStyle', weightVariable)
      style.setBoundVariable('fontFamily', familyVariable)
    } else {
      style.setBoundVariable('fontFamily', familyVariable)
      style.setBoundVariable('fontStyle', weightVariable)
    }
    report.styleIds[want.name] = style.id
  }

  return report
}
