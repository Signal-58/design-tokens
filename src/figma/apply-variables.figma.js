/**
 * Runs inside Figma (Plugin API), not in Node. build.ts inlines this function, with `export `
 * removed, into the S58 Tokens plugin and into the use_figma script, with the spec from
 * variables.ts.
 *
 * It writes variables collection by collection, in spec order, matching by name:
 * - a collection the spec names but Figma lacks is created, with the spec's modes, unless the spec
 *   marks it `required` (then the run stops before writing anything); missing modes are added;
 * - a variable the spec names but Figma lacks is created, with the spec's scopes (none if it gives
 *   none, as primitives have);
 * - values are written per mode: `value` or `aliasOf` (with `aliasCollection`) go in the default
 *   mode, `modes` names a value for each mode. A value is a plain value or `{ aliasOf, collection? }`,
 *   an alias to a variable in that collection (default: the same one). Every collection's plain
 *   values are written before any alias, so an alias can point at a variable created in this run;
 * - a variable whose value differs is updated in place, so aliases and bindings to it stay;
 * - scopes, code syntax (WEB) and description are written when the spec gives them;
 * - a variable that is an alias where the spec has a plain value, or of another type, is left
 *   alone and reported;
 * - colour values are only written when the file's documentColorProfile matches spec.colorProfile,
 *   because the same numbers mean different colours in sRGB and Display P3;
 * - variables in a managed group that the spec doesn't name are reported, never deleted.
 *
 * With dryRun it changes nothing and reports what it would do.
 *
 * @param {object} spec The spec from buildVariablesSpec().
 * @param {boolean} dryRun Report only.
 */
export async function applyVariables(spec, dryRun) {
  const report = { dryRun, created: [], updated: [], unchanged: 0, figmaOnly: [], warnings: [] }
  // Figma stores numbers as 32-bit floats: 53.7477 reads back as 53.74769973754883.
  const near = (a, b) => Math.abs(a - b) < 0.0005
  const isColour = (v) => typeof v === 'object' && v !== null && 'r' in v
  const isAlias = (v) => typeof v === 'object' && v !== null && v.type === 'VARIABLE_ALIAS'
  const same = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return near(a, b)
    if (isColour(a) && isColour(b)) {
      return near(a.r, b.r) && near(a.g, b.g) && near(a.b, b.b) && near(a.a ?? 1, b.a ?? 1)
    }
    return a === b
  }
  const show = (v) =>
    isColour(v)
      ? `rgba(${[v.r, v.g, v.b].map((x) => Math.round(x * 1000) / 1000).join(', ')}, ${Math.round((v.a ?? 1) * 100) / 100})`
      : v
  const sameScopes = (a, b) => a.length === b.length && a.every((s) => b.includes(s))
  const profileOk = !spec.colorProfile || figma.root.documentColorProfile === spec.colorProfile
  const hasColours = spec.collections.some((c) => c.variables.some((v) => v.type === 'COLOR'))
  if (!profileOk && hasColours) {
    report.warnings.push(
      `The file's colour profile is ${figma.root.documentColorProfile}, not ${spec.colorProfile}: colour variables were skipped. Change it in File > Color profile, then run again.`,
    )
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const allVariables = await figma.variables.getLocalVariablesAsync()
  for (const want of spec.collections) {
    if (want.required && !collections.some((c) => c.name === want.name)) {
      throw new Error(`No variable collection named "${want.name}"`)
    }
  }

  // Variables by collection name and variable name, including those created in this run.
  const registry = new Map()
  const key = (collection, name) => `${collection}\u0000${name}`
  const collectionName = new Map(collections.map((c) => [c.id, c.name]))
  for (const v of allVariables) {
    const owner = collectionName.get(v.variableCollectionId)
    if (owner) registry.set(key(owner, v.name), v)
  }

  // Each entry's values as [mode name or null for the default mode, value].
  const valuesOf = (e) =>
    e.modes
      ? Object.entries(e.modes)
      : [[null, 'aliasOf' in e ? { aliasOf: e.aliasOf, collection: e.aliasCollection } : e.value]]
  const hasAlias = (e) => valuesOf(e).some(([, v]) => v && typeof v === 'object' && 'aliasOf' in v)

  const prepared = []
  for (const want of spec.collections) {
    let collection = collections.find((c) => c.name === want.name)
    const modeNames = want.modes ?? []
    if (!collection) {
      report.created.push({
        name: want.name,
        value: `new collection${modeNames.length ? ` (${modeNames.join(', ')})` : ''}`,
      })
      if (!dryRun) {
        collection = figma.variables.createVariableCollection(want.name)
        if (modeNames.length) collection.renameMode(collection.defaultModeId, modeNames[0])
      }
    }
    const modeIds = new Map((collection ? collection.modes : []).map((m) => [m.name, m.modeId]))
    for (const modeName of modeNames) {
      if (modeIds.has(modeName)) continue
      if (collection && !collection.modes.some((m) => m.name === modeName)) {
        report.created.push({ name: `${want.name}: mode ${modeName}`, value: 'new mode' })
        if (!dryRun) modeIds.set(modeName, collection.addMode(modeName))
      }
    }
    if (collection && !want.modes && collection.modes.length > 1) {
      report.warnings.push(
        `"${collection.name}" has ${collection.modes.length} modes; only the default mode is written.`,
      )
    }
    const defaultMode = collection ? collection.defaultModeId : null
    const label = (name) => `${want.name}: ${name}`

    prepared.push({ want, collection, modeIds, defaultMode, label })
  }

  // Plain values in every collection first, then aliases, so an alias can point at a variable
  // created in this run, in any collection.
  for (const aliases of [false, true]) {
    for (const { want, collection, modeIds, defaultMode, label } of prepared) {
      const ordered = want.variables.filter(
        (e) => (profileOk || e.type !== 'COLOR') && hasAlias(e) === aliases,
      )

      for (const entry of ordered) {
        const existing = registry.get(key(want.name, entry.name))
        if (existing && existing.resolvedType !== entry.type) {
          report.warnings.push(
            `${label(entry.name)} is ${existing.resolvedType}, not ${entry.type}; left unchanged.`,
          )
          continue
        }

        // Work out each mode's change before touching anything.
        const writes = []
        let skip = false
        for (const [modeName, value] of valuesOf(entry)) {
          const modeId = modeName === null ? defaultMode : modeIds.get(modeName)
          const where = modeName === null ? entry.name : `${entry.name} (${modeName})`
          const current = existing && modeId ? existing.valuesByMode[modeId] : undefined
          if (value && typeof value === 'object' && 'aliasOf' in value) {
            const targetCollection = value.collection ?? want.name
            const target = registry.get(key(targetCollection, value.aliasOf))
            const targetLabel =
              targetCollection === want.name
                ? value.aliasOf
                : `${targetCollection}: ${value.aliasOf}`
            if (!target && !dryRun) {
              report.warnings.push(`${label(where)} points at ${targetLabel}, which doesn't exist.`)
              skip = true
              break
            }
            if (isAlias(current) && target && current.id === target.id) continue
            writes.push({
              modeName,
              where,
              from: isAlias(current) ? 'another alias' : show(current),
              to: `alias to ${targetLabel}`,
              write: () => figma.variables.createVariableAlias(target),
            })
            continue
          }
          if (isAlias(current)) {
            report.warnings.push(`${label(where)} is an alias; left unchanged.`)
            continue
          }
          if (existing && same(current, value)) continue
          writes.push({ modeName, where, from: show(current), to: show(value), write: () => value })
        }
        if (skip) continue

        const meta = []
        if (existing) {
          if (entry.scopes && !sameScopes(existing.scopes, entry.scopes)) {
            meta.push({
              what: 'scopes',
              from: existing.scopes.join(', ') || 'none',
              to: entry.scopes.join(', ') || 'none',
              write: (v) => (v.scopes = entry.scopes),
            })
          }
          const codeSyntax = (existing.codeSyntax && existing.codeSyntax.WEB) || ''
          if (entry.codeSyntax !== undefined && codeSyntax !== entry.codeSyntax) {
            meta.push({
              what: 'code syntax',
              from: codeSyntax || 'none',
              to: entry.codeSyntax,
              write: (v) => v.setVariableCodeSyntax('WEB', entry.codeSyntax),
            })
          }
          if (
            entry.description !== undefined &&
            (existing.description || '') !== entry.description
          ) {
            meta.push({
              what: 'description',
              from: existing.description || 'none',
              to: entry.description,
              write: (v) => (v.description = entry.description),
            })
          }
        }

        if (!existing) {
          report.created.push({
            name: label(entry.name),
            value:
              writes.length === 1 && writes[0].modeName === null
                ? writes[0].to
                : writes.map((w) => (w.modeName ? `${w.modeName}: ${w.to}` : w.to)).join('; '),
          })
        } else if (!writes.length && !meta.length) {
          report.unchanged++
          continue
        } else {
          for (const w of writes)
            report.updated.push({ name: label(w.where), from: w.from, to: w.to })
          for (const m of meta) {
            report.updated.push({ name: `${label(entry.name)} ${m.what}`, from: m.from, to: m.to })
          }
        }
        if (dryRun) continue

        const variable =
          existing || figma.variables.createVariable(entry.name, collection, entry.type)
        if (!existing) {
          variable.scopes = entry.scopes ?? []
          if (entry.codeSyntax) variable.setVariableCodeSyntax('WEB', entry.codeSyntax)
          if (entry.description) variable.description = entry.description
          registry.set(key(want.name, entry.name), variable)
        }
        for (const w of writes) {
          variable.setValueForMode(
            w.modeName === null ? defaultMode : modeIds.get(w.modeName),
            w.write(),
          )
        }
        for (const m of meta) m.write(variable)
      }
    }
  }

  for (const { want, collection, label } of prepared) {
    const names = new Set(want.variables.map((v) => v.name))
    if (collection) {
      for (const v of allVariables) {
        if (v.variableCollectionId !== collection.id) continue
        const managed = want.managedGroups.some((g) => v.name.startsWith(`${g}/`))
        if (managed && !names.has(v.name)) report.figmaOnly.push(label(v.name))
      }
    }
  }

  return report
}
