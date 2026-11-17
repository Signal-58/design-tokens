import { describe, expect, it } from 'vitest'

import {
  buildFigmaPlugin,
  buildTextStylesScript as buildFigmaScript,
  buildTextStyleSpec as buildSpec,
  type TextStyleSpec,
  type TypographyFonts,
  inlineFigmaFunction,
  type TypographyRole,
} from '../src/index'
import { FILE, inFile } from './file-guard'

/** The collections and groups in the S58 starter Figma file. */
const typographyFigma = {
  fontCollection: 'Type primitives',
  fontFamilyGroup: 'Font family',
  fontWeightGroup: 'Font weight',
  sizeCollection: 'Fluid tokens',
  fontSizeGroup: 'Font size',
}

const buildTextStyleSpec = (
  roles: Record<string, TypographyRole> = typographyRoles,
  fontConfig: TypographyFonts = typographyFonts,
) => buildSpec(roles, fontConfig, typographyFigma)

// Fonts and roles of the tests' own. The brand fonts stand for fonts installed only on a
// designer's computer: the stand-in for Figma can't load them, as Figma's cloud can't.
const fonts = {
  families: {
    Body: 'Brand Text',
    Heading: 'Brand Display',
    Brand: 'Brand Display',
    Logo: 'Brand Display',
    Mono: 'Brand Mono',
  },
  weights: { Regular: 'Regular', Default: 'Regular', Medium: 'Medium', Bold: 'Bold' },
}
const heading = {
  figmaGroup: 'Heading',
  purpose: 'Headings and titles',
  family: 'Heading',
  weight: 'Bold',
  steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  lineHeight: 100,
  letterSpacing: -3.15,
  paragraphSpacing: 0,
  elements: { 6: 'h1' },
} as const satisfies TypographyRole
const body = {
  figmaGroup: 'Body',
  purpose: 'Body text',
  family: 'Body',
  weight: 'Regular',
  steps: [-1, 0, 6, 12],
  lineHeight: { variable: 'Font size/Step {step}' },
  letterSpacing: { variable: 'Letter spacing/Step {step}' },
  paragraphSpacing: { variable: 'Font size/Step {step}', maxStep: 10 },
  overrides: {
    0: { lineHeight: 'auto' },
    12: { weight: 'Default' },
    [-1]: { lineHeight: { variable: 'Font size/Step 0' } },
  },
} as const satisfies TypographyRole
const prose = {
  figmaGroup: 'Prose',
  purpose: 'Reading text',
  family: 'Body',
  weight: 'Regular',
  steps: [3],
  lineHeight: 160,
  letterSpacing: 0,
  paragraphSpacing: { variable: 'Font size/Step {step}' },
} as const satisfies TypographyRole
const code = {
  figmaGroup: 'Code',
  purpose: 'Code',
  family: 'Mono',
  weight: 'Regular',
  steps: [3],
  lineHeight: { variable: 'Font size/Step {step}' },
  letterSpacing: 0,
  paragraphSpacing: 0,
} as const satisfies TypographyRole
const typographyFonts = fonts
const typographyRoles = { heading, body, prose, code }
const specFor = (roles: Record<string, TypographyRole>) => buildTextStyleSpec(roles, fonts)

interface MockVariable {
  id: string
  name: string
  variableCollectionId: string
  valuesByMode: Record<string, unknown>
  setValueForMode: (modeId: string, value: unknown) => void
}

interface Font {
  family: string
  style: string
}

interface MockStyle {
  id: string
  name: string
  description: string
  fontName: Font
  fontSize: number
  lineHeight: { unit: string; value?: number }
  letterSpacing: { unit: string; value: number }
  paragraphSpacing: number
  boundVariables: Record<string, { type: string; id: string }>
  setBoundVariable: (field: string, variable: MockVariable | null) => void
}

interface StyleInit {
  id: string
  name: string
  fontName?: Font
  letterSpacing?: { unit: string; value: number }
}

/**
 * A stand-in for the parts of the Figma Plugin API the script uses. Like Figma's cloud runner, it
 * can only load the fonts in `loadable`, refuses to edit a style whose font isn't loaded, and lets a
 * style be bound to a font variable without loading the font.
 */
function mockFigma(
  spec: TextStyleSpec,
  opts: { loadable?: string[]; existing?: StyleInit[]; blank?: boolean; noSizes?: boolean } = {},
) {
  const collections = [
    ...(opts.blank
      ? []
      : [
          {
            id: 'c-type',
            name: 'Type primitives',
            defaultModeId: 'm1',
            modes: [{ modeId: 'm1', name: 'Mode 1' }],
          },
        ]),
    ...(opts.noSizes
      ? []
      : [
          {
            id: 'c-fluid',
            name: 'Fluid tokens',
            defaultModeId: 'min',
            modes: [{ modeId: 'min', name: 'Min' }],
          },
        ]),
  ]
  let nextId = 1
  const variable = (collectionId: string, name: string, value: unknown): MockVariable => {
    const v: MockVariable = {
      id: `v${nextId++}`,
      name,
      variableCollectionId: collectionId,
      valuesByMode: { [collectionId === 'c-type' ? 'm1' : 'min']: value },
      setValueForMode(modeId, val) {
        v.valuesByMode[modeId] = val
      },
    }
    return v
  }
  const variables: (MockVariable & { scopes?: string[] })[] = [
    ...(opts.blank ? [] : spec.fontVariables.map((f) => variable('c-type', f.variable, f.value))),
    ...(opts.noSizes
      ? []
      : [
          ...Array.from({ length: 19 }, (_, i) =>
            variable('c-fluid', `Font size/Step ${i - 4}`, 10 + i),
          ),
          ...Array.from({ length: 19 }, (_, i) =>
            variable('c-fluid', `Letter spacing/Step ${i - 4}`, -i / 10),
          ),
        ]),
  ]
  const byId = (id: string) => variables.find((v) => v.id === id)
  const valueOf = (id: string) => String(Object.values(byId(id)!.valuesByMode)[0])

  const loadable = new Set(opts.loadable ?? ['Inter|Regular', 'Inter|Bold'])
  const loaded = new Set<string>()
  const key = (font: Font) => `${font.family}|${font.style}`

  const makeStyle = (init: StyleInit | undefined): MockStyle => {
    let font: Font = init?.fontName ?? { family: 'Inter', style: 'Regular' }
    const values = {
      fontSize: 12,
      lineHeight: { unit: 'AUTO' } as MockStyle['lineHeight'],
      letterSpacing: init?.letterSpacing ?? { unit: 'PERCENT', value: 0 },
      paragraphSpacing: 0,
    }
    const requireLoaded = (field: string) => {
      if (!loaded.has(key(font))) {
        throw new Error(
          `in set_${field}: Cannot write to node with unloaded font "${font.family} ${font.style}"`,
        )
      }
    }
    const style = {
      id: init?.id ?? `s${nextId++}`,
      name: init?.name ?? '',
      boundVariables: {} as MockStyle['boundVariables'],
      setBoundVariable(field: string, v: MockVariable | null) {
        if (!v) {
          delete style.boundVariables[field]
          return
        }
        style.boundVariables[field] = { type: 'VARIABLE_ALIAS', id: v.id }
        if (field === 'fontFamily' || field === 'fontStyle') {
          // Figma accepts an unloaded font here only if the file already uses it.
          const next =
            field === 'fontFamily'
              ? { ...font, family: valueOf(v.id) }
              : { ...font, style: valueOf(v.id) }
          const inFile = styles.some((s) => s !== style && key(s.fontName) === key(next))
          if (!loaded.has(key(next)) && !inFile) {
            throw new Error(`in setBoundVariable: unloaded font "${next.family} ${next.style}"`)
          }
          font = next
        } else {
          requireLoaded(field)
          const px = Number(valueOf(v.id))
          if (field === 'fontSize' || field === 'paragraphSpacing') values[field] = px
          else values[field as 'lineHeight' | 'letterSpacing'] = { unit: 'PIXELS', value: px }
        }
      },
    } as MockStyle
    // Figma stores descriptions HTML-escaped.
    let description = ''
    Object.defineProperty(style, 'description', {
      get: () => description,
      set: (next: string) => {
        description = next.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      },
    })
    Object.defineProperty(style, 'fontName', {
      get: () => font,
      set: (next: Font) => {
        if (!loaded.has(key(next))) throw new Error(`Font "${key(next)}" is not loaded`)
        font = next
      },
    })
    for (const field of ['fontSize', 'lineHeight', 'letterSpacing', 'paragraphSpacing'] as const) {
      Object.defineProperty(style, field, {
        get: () => values[field],
        set: (next: never) => {
          requireLoaded(field)
          values[field] = next
        },
      })
    }
    return style
  }
  const styles: MockStyle[] = (opts.existing ?? []).map((s) => makeStyle(s))

  const figma = {
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async () => variables,
      createVariableCollection: (name: string) => {
        const c = {
          id: 'c-type',
          name,
          defaultModeId: 'm1',
          modes: [{ modeId: 'm1', name: 'Mode 1' }],
        }
        collections.push(c)
        return c
      },
      createVariable: (name: string, collection: { id: string }, type: string) => {
        if (type !== 'STRING') throw new Error(`Unexpected variable type ${type}`)
        const v = Object.assign(variable(collection.id, name, undefined), {
          scopes: [] as string[],
        })
        variables.push(v)
        return v
      },
    },
    listAvailableFontsAsync: async () =>
      [...loadable].map((f) => ({ fontName: { family: f.split('|')[0], style: f.split('|')[1] } })),
    loadFontAsync: async (font: Font) => {
      if (!loadable.has(key(font)))
        throw new Error(`The font "${font.family} ${font.style}" could not be loaded`)
      loaded.add(key(font))
    },
    getLocalTextStylesAsync: async () => styles,
    createTextStyle: () => {
      const s = makeStyle(undefined)
      styles.push(s)
      return s
    },
  }
  return { figma, styles, variables, collections, loaded, byId }
}

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(inFile(figma as object))
}

// An existing style that already uses Brand Display Bold, as a project's Strong/* styles might.
const strong: StyleInit = {
  id: 'strong',
  name: 'Strong/Step 6',
  fontName: { family: 'Brand Display', style: 'Bold' },
}

describe('buildTextStyleSpec', () => {
  const spec = buildTextStyleSpec()

  it('creates one heading style per Utopia step, bound to the step size', () => {
    const headings = spec.styles.filter((s) => s.name.startsWith('Heading/'))
    expect(headings.map((s) => s.name)).toEqual(
      typographyRoles.heading.steps.map((step) => `Heading/Step ${step}`),
    )
    expect(headings.every((s) => s.familyVariable === 'Font family/Heading')).toBe(true)
    expect(
      headings.every((s) => s.weightVariable === `Font weight/${typographyRoles.heading.weight}`),
    ).toBe(true)
    expect(headings.find((s) => s.name === 'Heading/Step 6')?.sizeVariable).toBe('Font size/Step 6')
  })

  it('notes the HTML element and the source in each description', () => {
    const h1 = spec.styles.find((s) => s.name === 'Heading/Step 6')!
    expect(h1.description).toContain('h1 in code')
    expect(h1.description).toContain('design-tokens/typography.config.ts')
    expect(spec.styles.find((s) => s.name === 'Heading/Step 0')!.description).not.toContain(
      'in code',
    )
  })

  it('lists every font family and weight variable from the config', () => {
    const names = spec.fontVariables.map((f) => f.variable)
    for (const k of Object.keys(typographyFonts.families))
      expect(names).toContain(`Font family/${k}`)
    for (const k of Object.keys(typographyFonts.weights))
      expect(names).toContain(`Font weight/${k}`)
  })

  it('rejects two roles writing the same style', () => {
    const role = typographyRoles.heading
    expect(() => buildTextStyleSpec({ a: role, b: role })).toThrow(/Two roles/)
  })

  it('writes a line height per step from a value per step', () => {
    const role: TypographyRole = {
      ...typographyRoles.heading,
      figmaGroup: 'Stepped',
      steps: [0, 1, 2],
      lineHeight: { byStep: { 0: 115, 1: 110, 2: 105 } },
    }
    const { styles } = buildTextStyleSpec({ stepped: role })
    expect(styles.map((s) => s.lineHeight)).toEqual([115, 110, 105])
    expect(() =>
      buildTextStyleSpec({
        stepped: { ...role, steps: [0, 3], lineHeight: { byStep: { 0: 115 } } },
      }),
    ).toThrow(/No value for step 3/)
  })
})

describe('the generated Figma script', () => {
  const spec = specFor({ heading })

  it('changes nothing on a dry run', async () => {
    const mock = mockFigma(spec, { existing: [strong] })
    const report = await run(buildFigmaScript(spec, true, FILE), mock.figma)
    expect(report.created).toHaveLength(spec.styles.length)
    expect(mock.styles).toHaveLength(1)
    expect(mock.loaded.size).toBe(0)
  })

  it('creates the font collection and variables on a blank file', async () => {
    const inter = {
      families: { Body: 'Inter', Heading: 'Inter', Brand: 'Inter', Logo: 'Inter', Mono: 'Inter' },
      weights: { Regular: 'Regular', Default: 'Regular', Medium: 'Medium', Bold: 'Bold' },
    }
    const blankSpec = buildTextStyleSpec({ heading }, inter)

    const dry = mockFigma(blankSpec, { blank: true })
    const preview = await run(buildFigmaScript(blankSpec, true, FILE), dry.figma)
    expect(preview.variables).toContainEqual({
      name: 'Type primitives',
      from: 'none',
      to: 'new collection',
    })
    expect(preview.variables).toContainEqual({
      name: 'Font family/Heading',
      from: 'none',
      to: 'Inter',
    })
    expect(preview.created).toHaveLength(blankSpec.styles.length)
    expect(dry.collections.map((c) => c.name)).toEqual(['Fluid tokens'])
    expect(dry.styles).toHaveLength(0)

    const mock = mockFigma(blankSpec, { blank: true })
    const report = await run(buildFigmaScript(blankSpec, false, FILE), mock.figma)
    expect(report.created).toHaveLength(blankSpec.styles.length)
    expect(mock.variables.find((v) => v.name === 'Font family/Heading')?.scopes).toEqual([
      'FONT_FAMILY',
    ])
    expect(mock.variables.find((v) => v.name === 'Font weight/Bold')?.scopes).toEqual([
      'FONT_STYLE',
    ])
    const h1 = mock.styles.find((s) => s.name === 'Heading/Step 6')!
    expect(mock.byId(h1.boundVariables.fontFamily.id)?.name).toBe('Font family/Heading')
    expect(h1.fontName).toEqual({ family: 'Inter', style: 'Bold' })

    const rerun = await run(buildFigmaScript(blankSpec, false, FILE), mock.figma)
    expect(rerun.variables).toEqual([])
    expect(rerun.unchanged).toHaveLength(blankSpec.styles.length)
  })

  it('dry-runs before the size variables exist when the variables module plans them', async () => {
    // What the plugin passes: every variable the variables module creates in the same run.
    const sizes = spec.styles.flatMap((st) =>
      [st.sizeVariable, st.lineHeight, st.letterSpacing, st.paragraphSpacing].flatMap((v) =>
        typeof v === 'string' ? [v] : typeof v === 'object' && v !== null ? [v.variable] : [],
      ),
    )
    const planned = [...new Set(sizes)].map((name) => `Fluid tokens\u0000${name}`)
    const script = (dryRun: boolean, plan: string[]) =>
      [
        inlineFigmaFunction('apply-text-styles.figma.js'),
        `return await applyTextStyles(${JSON.stringify(spec)}, ${dryRun}, ${JSON.stringify(plan)})`,
      ].join('\n')

    const empty = mockFigma(spec, { blank: true, noSizes: true })
    const preview = await run(script(true, planned), empty.figma)
    expect(preview.created).toHaveLength(spec.styles.length)
    // The only warning is for the fixture's font, which the stand-in can't load.
    expect(preview.warnings.join('\n')).not.toMatch(/Fluid tokens|Font size|Letter spacing/)
    expect(empty.collections).toHaveLength(0)

    await expect(run(script(true, []), empty.figma)).rejects.toThrow(
      'No variable collection named "Fluid tokens"',
    )
  })

  it('creates the styles without loading the real font, then is a no-op on a rerun', async () => {
    const mock = mockFigma(spec, { existing: [strong] })
    const script = buildFigmaScript(spec, false, FILE)
    const first = await run(script, mock.figma)
    expect(first.created).toHaveLength(spec.styles.length)
    expect(first.warnings).toEqual([])

    const h1 = mock.styles.find((s) => s.name === 'Heading/Step 6')!
    expect(mock.byId(h1.boundVariables.fontFamily.id)?.name).toBe('Font family/Heading')
    expect(mock.byId(h1.boundVariables.fontStyle.id)?.name).toBe('Font weight/Bold')
    expect(mock.byId(h1.boundVariables.fontSize.id)?.name).toBe('Font size/Step 6')
    expect(h1.fontName).toEqual({ family: 'Brand Display', style: 'Bold' })
    expect(h1.lineHeight).toEqual({ unit: 'PERCENT', value: 100 })
    expect(h1.letterSpacing).toEqual({ unit: 'PERCENT', value: -3.15 })
    expect([...mock.loaded]).toEqual(['Inter|Bold'])

    const second = await run(script, mock.figma)
    expect(second.created).toHaveLength(0)
    expect(second.updated).toHaveLength(0)
    expect(second.unchanged).toHaveLength(spec.styles.length)
  })

  it('updates a bound style whose font is not loadable, and reports orphans without deleting them', async () => {
    const mock = mockFigma(spec, { existing: [strong] })
    await run(buildFigmaScript(spec, false, FILE), mock.figma)
    const h1 = mock.styles.find((s) => s.name === 'Heading/Step 6')!
    const id = h1.id

    const tighter = specFor({ heading: { ...heading, letterSpacing: -4 } })
    const orphan = mock.figma.createTextStyle()
    orphan.name = 'Heading/Step 14'
    const report = await run(buildFigmaScript(tighter, false, FILE), mock.figma)

    expect(report.updated).toContainEqual({ name: 'Heading/Step 6', changes: ['letterSpacing'] })
    const updated = mock.styles.find((s) => s.id === id)!
    expect(updated.letterSpacing).toEqual({ unit: 'PERCENT', value: -4 })
    expect(updated.fontName).toEqual({ family: 'Brand Display', style: 'Bold' })
    expect(report.orphans).toEqual([{ id: orphan.id, name: 'Heading/Step 14' }])
    expect(mock.styles.some((s) => s.id === orphan.id)).toBe(true)
  })

  it('writes changed font values to the variables, which is how a typeface changes', async () => {
    const changed = buildTextStyleSpec(
      { heading },
      {
        families: { ...fonts.families, Heading: 'Inter' },
        weights: { ...fonts.weights, Bold: 'Regular' },
      },
    )
    const mock = mockFigma(spec)
    const report = await run(buildFigmaScript(changed, false, FILE), mock.figma)
    expect(report.variables).toContainEqual({
      name: 'Font family/Heading',
      from: 'Brand Display',
      to: 'Inter',
    })
    expect(mock.variables.find((v) => v.name === 'Font family/Heading')!.valuesByMode.m1).toBe(
      'Inter',
    )
    expect(mock.styles.find((s) => s.name === 'Heading/Step 6')!.fontName).toEqual({
      family: 'Inter',
      style: 'Regular',
    })
  })

  it('warns about a font that no style uses and Figma cannot load', async () => {
    const mock = mockFigma(spec)
    const report = await run(buildFigmaScript(spec, true, FILE), mock.figma)
    expect(report.warnings).toContainEqual(expect.stringContaining('"Brand Display Bold"'))
  })

  it('reaches a weight the placeholder font lacks through a weight the family already uses', async () => {
    // Inter Medium can't be loaded here, so the script binds the family first (Inter Bold to
    // Brand Display Bold, used by Strong/*), then the weight (Brand Display Medium, used by Brand/*).
    const medium = specFor({ heading: { ...heading, weight: 'Medium' } })
    const brand: StyleInit = {
      id: 'brand',
      name: 'Brand/Logo',
      fontName: { family: 'Brand Display', style: 'Medium' },
    }
    const mock = mockFigma(medium, { existing: [strong, brand] })
    const report = await run(buildFigmaScript(medium, false, FILE), mock.figma)
    expect(report.created).toHaveLength(medium.styles.length)
    expect(mock.styles.find((s) => s.name === 'Heading/Step 6')!.fontName).toEqual({
      family: 'Brand Display',
      style: 'Medium',
    })
    expect([...mock.loaded]).toEqual(['Inter|Bold'])
  })
})

describe('the local Figma plugin', () => {
  const spec = specFor({ heading })

  function openPlugin(code: string, figma: object) {
    const messages: {
      type: string
      dryRun?: boolean
      reports?: { textStyles?: { dryRun: boolean; created: string[] } }
      message?: string
    }[] = []
    let closed = false
    const ui = {
      postMessage: (msg: (typeof messages)[number]) => messages.push(msg),
      onmessage: undefined as undefined | ((msg: { type: string }) => Promise<void> | void),
    }
    const plugin = {
      ...inFile(figma),
      ui,
      showUI: () => {},
      closePlugin: () => {
        closed = true
      },
    }
    new Function('figma', code)(plugin)
    const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
    return { messages, ui, settle, isClosed: () => closed }
  }

  it('shows a dry run on open and applies only when Apply is clicked', async () => {
    const mock = mockFigma(spec, { existing: [strong] })
    const builtAt = new Date('2026-11-16T13:40:00Z')
    const plugin = openPlugin(buildFigmaPlugin({ textStyles: spec }, FILE, builtAt), mock.figma)
    await plugin.settle()
    expect(plugin.messages[0].type).toBe('report')
    expect(plugin.messages[0]).toMatchObject({ builtAt: builtAt.toISOString() })
    expect(plugin.messages[0]).toMatchObject({ dryRun: true })
    expect(plugin.messages[0].reports!.textStyles!.created).toHaveLength(spec.styles.length)
    expect(mock.styles).toHaveLength(1)

    await plugin.ui.onmessage!({ type: 'apply' })
    expect(plugin.messages[1]).toMatchObject({ dryRun: false })
    expect(mock.styles).toHaveLength(spec.styles.length + 1)

    await plugin.ui.onmessage!({ type: 'close' })
    expect(plugin.isClosed()).toBe(true)
  })

  it('shows an error instead of throwing', async () => {
    const mock = mockFigma(spec)
    const broken = { ...spec, figma: { ...spec.figma, sizeCollection: 'Missing' } }
    const plugin = openPlugin(buildFigmaPlugin({ textStyles: broken }, FILE), mock.figma)
    await plugin.settle()
    expect(plugin.messages).toEqual([
      { type: 'error', message: 'No variable collection named "Missing"' },
    ])
  })
})

describe('variable-bound spacing and step overrides', () => {
  const spec = specFor({ body, prose, code, heading })
  const style = (name: string) => spec.styles.find((s) => s.name === name)!

  it('resolves {step}, maxStep and per-step overrides', () => {
    expect(style('Body/Step 6')).toMatchObject({
      weightVariable: 'Font weight/Regular',
      lineHeight: { variable: 'Font size/Step 6' },
      letterSpacing: { variable: 'Letter spacing/Step 6' },
      paragraphSpacing: { variable: 'Font size/Step 6' },
    })
    expect(style('Body/Step 12')).toMatchObject({
      weightVariable: 'Font weight/Default',
      paragraphSpacing: { variable: 'Font size/Step 10' },
    })
    expect(style('Body/Step 0').lineHeight).toBe('auto')
    expect(style('Body/Step -1').lineHeight).toEqual({ variable: 'Font size/Step 0' })
    expect(style('Prose/Step 3')).toMatchObject({ lineHeight: 160, letterSpacing: 0 })
  })

  // Every font the test roles use, as styles in S58 Marketing already do.
  const fontsInFile: StyleInit[] = [
    ['Brand Text', 'Regular'],
    ['Brand Text', 'Medium'],
    ['Brand Display', 'Bold'],
    ['Brand Display', 'Medium'],
    ['Brand Mono', 'Regular'],
  ].map(([family, style], i) => ({ id: `f${i}`, name: `Fonts/${i}`, fontName: { family, style } }))

  it('writes every role, binding spacing where asked, and a rerun changes nothing', async () => {
    const mock = mockFigma(spec, {
      existing: fontsInFile,
      loadable: ['Inter|Regular', 'Inter|Medium', 'Inter|Bold'],
    })
    const script = buildFigmaScript(spec, false, FILE)
    const first = await run(script, mock.figma)
    expect(first.warnings).toEqual([])
    expect(first.created).toHaveLength(spec.styles.length)

    const big = mock.styles.find((s) => s.name === 'Body/Step 12')!
    expect(mock.byId(big.boundVariables.lineHeight.id)?.name).toBe('Font size/Step 12')
    expect(mock.byId(big.boundVariables.letterSpacing.id)?.name).toBe('Letter spacing/Step 12')
    expect(mock.byId(big.boundVariables.paragraphSpacing.id)?.name).toBe('Font size/Step 10')
    expect(big.fontName).toEqual({ family: 'Brand Text', style: 'Regular' })
    const prose = mock.styles.find((s) => s.name === 'Prose/Step 3')!
    expect(prose.boundVariables.lineHeight).toBeUndefined()
    expect(prose.lineHeight).toEqual({ unit: 'PERCENT', value: 160 })

    const second = await run(script, mock.figma)
    expect(second.updated).toEqual([])
    expect(second.unchanged).toHaveLength(spec.styles.length)
  })

  it('switches a value between bound and plain', async () => {
    const mock = mockFigma(spec, { existing: fontsInFile })
    const one = { ...heading, steps: [6], letterSpacing: 0 } as const
    await run(buildFigmaScript(specFor({ heading: one }), false, FILE), mock.figma)
    const h1 = () => mock.styles.find((s) => s.name === 'Heading/Step 6')!

    const bound = specFor({
      heading: { ...one, letterSpacing: { variable: 'Letter spacing/Step {step}' } },
    })
    const toBound = await run(buildFigmaScript(bound, false, FILE), mock.figma)
    expect(toBound.updated).toEqual([{ name: 'Heading/Step 6', changes: ['letterSpacing'] }])
    expect(mock.byId(h1().boundVariables.letterSpacing.id)?.name).toBe('Letter spacing/Step 6')

    const toPlain = await run(buildFigmaScript(specFor({ heading: one }), false, FILE), mock.figma)
    expect(toPlain.updated).toEqual([{ name: 'Heading/Step 6', changes: ['letterSpacing'] }])
    expect(h1().boundVariables.letterSpacing).toBeUndefined()
    expect(h1().letterSpacing).toEqual({ unit: 'PERCENT', value: 0 })
  })

  it('treats zero letter spacing in px as matching zero in %', async () => {
    const one = specFor({ code })
    const existing: StyleInit = {
      id: 'code3',
      name: 'Code/Step 3',
      fontName: { family: 'Brand Mono', style: 'Regular' },
      letterSpacing: { unit: 'PIXELS', value: 0 },
    }
    const mock = mockFigma(one, { existing: [...fontsInFile, existing] })
    const report = await run(buildFigmaScript(one, true, FILE), mock.figma)
    expect(report.updated[0].changes).not.toContain('letterSpacing')
  })
})
