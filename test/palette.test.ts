import { describe, expect, it } from 'vitest'

import {
  apcaContrast,
  apcaFailures,
  buildPalette as build,
  buildVariablesScript,
  contrastRatio,
  deltaE,
  fitToGamut,
  formatOklch,
  generateScale,
  inGamut,
  nearestStep,
  oklchToRgb,
  paletteVariables,
  parseColour,
  resolveScales as resolve,
  definePalette,
  defaultPaletteRules as paletteRules,
  type ColourScale,
  type Oklch,
  type PaletteConfig as FullPaletteConfig,
  type VariablesSpec,
} from '../src/index'

type PaletteConfig = Omit<FullPaletteConfig, 'figma'>

/** A palette of the tests' own: brand colours around the hue circle and a neutral, on the default rules. */
const palette = definePalette({
  scales: {
    brand: '#2F5BEA',
    accent: '#F3A512',
    jade: '#3ED7A6',
    red: '#E50E3F',
    purple: 'oklch(0.4939 0.215 298.31)',
    neutral: { colour: '#8B8D92', range: [0.975, 0.144] },
  },
  general: { black: ['neutral', 15], white: ['neutral', 1] },
})
const paletteSteps = palette.steps
const buildPalette = (config: PaletteConfig = palette) => build(config)
const resolveScales = (config: PaletteConfig = palette) => resolve(config)

const white: Oklch = { l: 1, c: 0, h: 0 }
const black: Oklch = { l: 0, c: 0, h: 0 }

describe('colour maths', () => {
  it('converts OKLCH to sRGB and Display P3', () => {
    const w = oklchToRgb(white, 'srgb')
    for (const ch of [w.r, w.g, w.b]) expect(ch).toBeCloseTo(1, 6)
    expect(oklchToRgb(black, 'p3')).toEqual({ r: 0, g: 0, b: 0 })
    // CSS Color 4: sRGB red is oklch(0.62796 0.25768 29.23).
    const red = oklchToRgb({ l: 0.62796, c: 0.25768, h: 29.23 }, 'srgb')
    expect(red.r).toBeCloseTo(1, 2)
    expect(red.g).toBeCloseTo(0, 2)
    expect(red.b).toBeCloseTo(0, 2)
  })

  it('knows which gamut a colour fits', () => {
    const p3Red = { l: 0.64, c: 0.28, h: 29 }
    expect(inGamut(p3Red, 'p3')).toBe(true)
    expect(inGamut(p3Red, 'srgb')).toBe(false)
    expect(inGamut(white, 'srgb')).toBe(true)
  })

  it('fits a colour by reducing chroma only', () => {
    const vivid = { l: 0.7, c: 0.4, h: 150 }
    const fitted = fitToGamut(vivid, 'p3')
    expect(inGamut(fitted, 'p3')).toBe(true)
    expect(fitted.l).toBe(vivid.l)
    expect(fitted.h).toBe(vivid.h)
    expect(fitted.c).toBeLessThan(vivid.c)
    expect(fitToGamut(white, 'p3')).toBe(white)
  })

  it('measures WCAG contrast and OKLab difference', () => {
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1)
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1)
    expect(deltaE(white, white)).toBe(0)
    expect(deltaE(white, { l: 0.98, c: 0, h: 0 })).toBeCloseTo(2, 5)
  })

  it('formats oklch() with trimmed numbers', () => {
    expect(formatOklch({ l: 0.85, c: 0.11, h: 74.3 })).toBe('oklch(0.85 0.11 74.3)')
    expect(formatOklch({ l: 0.1, c: 0.006, h: 270, alpha: 0.07 })).toBe('oklch(0.1 0.006 270 / 7%)')
  })
})

// A small palette of the tests' own, so editing palette.config.ts never breaks them.
const scale = (hue: number, ref?: ColourScale['ref']): ColourScale => ({
  hue,
  ref,
  lightness: [0.95, 0.7, 0.4],
  chroma: [0.03, 0.15, 0.08],
})
const fixture: PaletteConfig = {
  steps: 3,
  rules: { contrastOnWhite: [1.2, 3, 7], chroma: { lightest: 0.2, darkest: 0.4 } },
  gamut: 'p3',
  scales: {
    teal: scale(190, 2),
    stone: { ...scale(80, { l: 0.5, c: 0.01, h: 80 }), chroma: [0.01, 0.01, 0.01] },
  },
  general: { ink: ['teal', 3] as const, paper: { l: 1, c: 0, h: 0 } },
  alphas: {
    ink_alpha: { colour: { l: 0.2, c: 0.01, h: 190 }, ref: ['teal', 3] as const, alphas: [0, 50] },
    clear: { colour: { l: 1, c: 0, h: 0 }, alphas: [20] },
  },
}

describe('buildPalette', () => {
  const palette = buildPalette(fixture)
  const find = (group: string, name: string) =>
    palette.find((c) => c.group === group && c.name === name)

  it('lists general colours, alpha scales, then each scale with its ref first', () => {
    expect(palette.map((c) => `${c.group}/${c.name}`)).toEqual([
      'general/ink',
      'general/paper',
      'ink_alpha/a00',
      'ink_alpha/a50',
      'ink_alpha/ref',
      'clear/a20',
      'teal/ref',
      'teal/1',
      'teal/2',
      'teal/3',
      'stone/ref',
      'stone/1',
      'stone/2',
      'stone/3',
    ])
  })

  it('turns steps into aliases and keeps own colours as values', () => {
    expect(find('general', 'ink')?.aliasOf).toEqual({ group: 'teal', name: '3' })
    expect(find('general', 'ink')?.colour).toEqual(find('teal', '3')?.colour)
    expect(find('teal', 'ref')?.aliasOf).toEqual({ group: 'teal', name: '2' })
    expect(find('stone', 'ref')?.aliasOf).toBeUndefined()
    expect(find('stone', 'ref')?.colour).toEqual({ l: 0.5, c: 0.01, h: 80 })
    expect(find('ink_alpha', 'a50')?.colour.alpha).toBe(0.5)
  })

  it('rejects a scale with the wrong number of steps, or a ref to a missing step', () => {
    expect(() =>
      buildPalette({ ...fixture, scales: { teal: { ...scale(190), chroma: [0.1, 0.1] } } }),
    ).toThrow(/teal.chroma has 2 values; it needs 3/)
    expect(() => buildPalette({ ...fixture, general: { ink: ['teal', 9] as const } })).toThrow(
      /general\/ink points at teal 9/,
    )
  })
})

describe('a generated palette', () => {
  const palette = buildPalette()

  it('fits every colour into Display P3, moving none of them visibly', () => {
    for (const c of palette) {
      expect(inGamut(c.colour, 'p3'), `${c.group}/${c.name}`).toBe(true)
      expect(deltaE(c.configured, c.colour), `${c.group}/${c.name}`).toBeLessThan(1)
    }
  })

  it('gets lighter towards step 1 in every scale', () => {
    for (const [name, s] of Object.entries(resolveScales())) {
      expect(s.lightness, name).toHaveLength(paletteSteps)
      for (let i = 1; i < s.lightness.length; i++) {
        expect(s.lightness[i], `${name} step ${i + 1}`).toBeLessThanOrEqual(s.lightness[i - 1])
      }
    }
  })
})

describe('paletteVariables', () => {
  const where = {
    collection: 'Primitives',
    group: 'primitive/colors',
    colorProfile: 'DISPLAY_P3',
    scopes: ['ALL_FILLS', 'STROKE_COLOR'],
  } as const
  const collection = paletteVariables(buildPalette(fixture), where)
  const entry = (name: string) =>
    collection.variables.find((v) => v.name === `primitive/colors/${name}`)

  it('writes values in the profile and refs as aliases', () => {
    expect(entry('general/ink')).toEqual({
      name: 'primitive/colors/general/ink',
      type: 'COLOR',
      scopes: ['ALL_FILLS', 'STROKE_COLOR'],
      aliasOf: 'primitive/colors/teal/3',
    })
    expect(entry('general/paper')).toMatchObject({ scopes: ['ALL_FILLS', 'STROKE_COLOR'] })
    expect(entry('general/paper')).toMatchObject({ value: { r: 1, g: 1, b: 1, a: 1 } })
    expect(entry('ink_alpha/a50')).toMatchObject({ value: { a: 0.5 } })
    expect(collection.managedGroups).toContain('primitive/colors/teal')
  })
})

// ─── Applying colours in a stand-in for Figma ────────────────────────────────

interface MockVariable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: string
  scopes: string[]
  valuesByMode: Record<string, unknown>
  setValueForMode: (modeId: string, value: unknown) => void
}

function mockFigma(profile: string, seed: Partial<MockVariable>[] = []) {
  const collection = {
    id: 'c0',
    name: 'Primitives',
    defaultModeId: 'm0',
    modes: [{ modeId: 'm0' }],
  }
  let nextId = 1
  const variables: MockVariable[] = []
  const make = (init: Partial<MockVariable>) => {
    const v = {
      variableCollectionId: 'c0',
      resolvedType: 'COLOR',
      scopes: ['ALL_SCOPES'],
      valuesByMode: {},
      ...init,
      id: init.id ?? `v${nextId++}`,
      setValueForMode(modeId: string, value: unknown) {
        v.valuesByMode[modeId] = value
      },
    } as MockVariable
    variables.push(v)
    return v
  }
  seed.forEach(make)
  const figma = {
    root: { documentColorProfile: profile },
    variables: {
      getLocalVariableCollectionsAsync: async () => [collection],
      getLocalVariablesAsync: async () => variables,
      createVariable: (name: string) => make({ name, valuesByMode: {} }),
      createVariableAlias: (v: MockVariable) => ({ type: 'VARIABLE_ALIAS', id: v.id }),
    },
  }
  const byName = (name: string) => variables.find((v) => v.name === name)
  return { figma, byName }
}

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(figma)
}

describe('applying colour variables', () => {
  const spec: VariablesSpec = {
    colorProfile: 'DISPLAY_P3',
    collections: [
      {
        name: 'Primitives',
        managedGroups: ['p/teal'],
        variables: [
          { name: 'p/teal/ref', type: 'COLOR', aliasOf: 'p/teal/2' },
          { name: 'p/teal/2', type: 'COLOR', value: { r: 0.1, g: 0.5, b: 0.6, a: 1 } },
        ],
      },
    ],
  }

  it('creates values first, then aliases to them', async () => {
    const { figma, byName } = mockFigma('DISPLAY_P3')
    const report = await run(buildVariablesScript(spec, false), figma)
    expect(report.created.map((c: { name: string }) => c.name)).toEqual([
      'Primitives: p/teal/2',
      'Primitives: p/teal/ref',
    ])
    expect(byName('p/teal/ref')?.valuesByMode.m0).toEqual({
      type: 'VARIABLE_ALIAS',
      id: byName('p/teal/2')?.id,
    })
    expect(byName('p/teal/2')?.scopes).toEqual([])
  })

  it('leaves matching values and aliases alone, and updates changed ones', async () => {
    const { figma, byName } = mockFigma('DISPLAY_P3', [
      { id: 'two', name: 'p/teal/2', valuesByMode: { m0: { r: 0.1, g: 0.50004, b: 0.6, a: 1 } } },
      { name: 'p/teal/ref', valuesByMode: { m0: { r: 0, g: 0, b: 0, a: 1 } } },
    ])
    const report = await run(buildVariablesScript(spec, false), figma)
    expect(report.unchanged).toBe(1)
    expect(report.updated).toEqual([
      { name: 'Primitives: p/teal/ref', to: 'alias to p/teal/2', from: 'rgba(0, 0, 0, 1)' },
    ])
    expect(byName('p/teal/ref')?.valuesByMode.m0).toEqual({ type: 'VARIABLE_ALIAS', id: 'two' })
    const again = await run(buildVariablesScript(spec, false), figma)
    expect(again.unchanged).toBe(2)
  })

  it('skips colours when the file has another colour profile', async () => {
    const { figma, byName } = mockFigma('SRGB')
    const report = await run(buildVariablesScript(spec, false), figma)
    expect(report.created).toEqual([])
    expect(byName('p/teal/2')).toBeUndefined()
    expect(report.warnings[0]).toMatch(/colour profile is SRGB, not DISPLAY_P3/)
  })

  it('changes nothing in a dry run', async () => {
    const { figma, byName } = mockFigma('DISPLAY_P3')
    const report = await run(buildVariablesScript(spec, true), figma)
    expect(report.created).toHaveLength(2)
    expect(byName('p/teal/2')).toBeUndefined()
  })
})

// ─── Step 2: scales from a reference colour ──────────────────────────────────

describe('parseColour', () => {
  it('reads hex (sRGB) and oklch()', () => {
    expect(parseColour('#ff0000')).toEqual({ l: 0.628, c: 0.2577, h: 29.23 })
    expect(parseColour('#fff')).toEqual({ l: 1, c: 0, h: 0 })
    expect(parseColour('oklch(78% 0.162 74.3)')).toEqual({ l: 0.78, c: 0.162, h: 74.3 })
    expect(parseColour(' oklch(0.5 0.1 200) ')).toEqual({ l: 0.5, c: 0.1, h: 200 })
  })

  it('refuses anything else rather than guessing', () => {
    expect(() => parseColour('rgb(1, 2, 3)')).toThrow(/Can't read the colour/)
    expect(() => parseColour('#12345')).toThrow(/Can't read the colour/)
  })
})

describe('generateScale', () => {
  const rules = {
    contrastOnWhite: [1.1, 1.25, 1.45, 1.65, 1.9, 2.25, 2.6, 3, 3.6, 4.5, 5.2, 6.2, 7.4, 8.9, 10.7],
    chroma: { lightest: 0.13, darkest: 0.31 },
  }
  const amber = '#F3A512'
  const scale = generateScale(amber, rules, 'p3', 'amber')
  const colours = scale.lightness.map((l, i) => ({ l, c: scale.chroma[i], h: scale.hue }))
  const ref = parseColour(amber)

  it('puts the reference, unchanged, at the step nearest its own contrast', () => {
    expect(scale.ref).toBe(nearestStep(ref, rules.contrastOnWhite))
    expect(colours[(scale.ref as number) - 1]).toEqual(ref)
    expect(scale.hue).toBe(ref.h)
  })

  it("hits every other step's contrast on white", () => {
    colours.forEach((c, i) => {
      if (i === (scale.ref as number) - 1) return
      expect(contrastRatio(c, white), `step ${i + 1}`).toBeCloseTo(rules.contrastOnWhite[i], 1)
    })
  })

  it('gets darker each step, with chroma peaking at the reference', () => {
    for (let i = 1; i < 15; i++) expect(scale.lightness[i]).toBeLessThan(scale.lightness[i - 1])
    expect(Math.max(...scale.chroma)).toBe(scale.chroma[(scale.ref as number) - 1])
    for (const c of colours) expect(inGamut(c, 'p3')).toBe(true)
  })

  it('pins the reference to refStep, and refuses a step that breaks the order', () => {
    const r = scale.ref as number
    expect(generateScale({ colour: amber, refStep: r }, rules, 'p3').ref).toBe(r)
    expect(() => generateScale({ colour: amber, refStep: 12 }, rules, 'p3', 'amber')).toThrow(
      /amber: the reference at step 12 .* out of order/,
    )
    expect(() => generateScale({ colour: amber, refStep: 16 }, rules, 'p3', 'amber')).toThrow(
      /refStep must be 1 to 15/,
    )
  })

  it('spreads a neutral evenly across its range, at the reference chroma', () => {
    const ash = generateScale({ colour: 'oklch(0.9 0.004 280)', range: [0.97, 0.77] }, rules, 'p3')
    expect(ash.lightness[0]).toBe(0.97)
    expect(ash.lightness[14]).toBe(0.77)
    expect(ash.lightness[7]).toBeCloseTo(0.87, 4)
    expect(new Set(ash.chroma)).toEqual(new Set([0.004]))
    expect(ash.ref).toBe(6) // L 0.9 is nearest step 6 (0.8986)
  })

  it('applies overrides last', () => {
    const s = generateScale(
      { colour: amber, overrides: { 2: { c: 0.01 }, 15: { l: 0.3 } } },
      rules,
      'p3',
    )
    expect(s.chroma[1]).toBe(0.01)
    expect(s.lightness[14]).toBe(0.3)
    expect(() =>
      generateScale({ colour: amber, overrides: { 0: { c: 0 } } }, rules, 'p3', 'a'),
    ).toThrow(/a.overrides has step 0/)
  })

  it('builds a palette that mixes generated and given scales', () => {
    const palette = buildPalette({
      ...fixture,
      rules,
      steps: 15,
      scales: {
        amber,
        given: { hue: 10, lightness: Array(15).fill(0.5), chroma: Array(15).fill(0.05) },
      },
      general: {},
      alphas: {},
    })
    expect(palette.filter((c) => c.group === 'amber')).toHaveLength(16)
    expect(palette.find((c) => c.group === 'amber' && c.name === 'ref')?.aliasOf?.name).toBe(
      String(scale.ref),
    )
    expect(palette.filter((c) => c.group === 'given')).toHaveLength(15)
  })
})

describe('APCA', () => {
  const lc = (text: string, bg: string) => apcaContrast(parseColour(text), parseColour(bg))

  it('matches APCA-W3 0.0.98G reference values', () => {
    expect(lc('#888888', '#ffffff')).toBeCloseTo(63.06, 0)
    expect(lc('#ffffff', '#888888')).toBeCloseTo(-68.54, 0)
    expect(lc('#000000', '#ffffff')).toBeCloseTo(106.04, 0)
    expect(lc('#ffffff', '#000000')).toBeCloseTo(-107.88, 0)
    expect(lc('#777777', '#777777')).toBe(0)
  })

  // Brand colours across the hue circle, light and dark.
  const references = [
    '#F3A512',
    '#3ED7A6',
    'oklch(0.53 0.17 249.5)',
    'oklch(0.59 0.231 19.6)',
    'oklch(0.49 0.215 298.31)',
    'oklch(0.89 0.146 91.5)',
    'oklch(0.75 0.209 144.64)',
    'oklch(0.55 0.222 260.33)',
  ]

  it('meets the default floors in every hue the generator makes', () => {
    for (const ref of references) {
      expect(apcaFailures(generateScale(ref, paletteRules, 'p3', ref), paletteRules, ref)).toEqual(
        [],
      )
    }
  })

  it('reports each step that misses a floor', () => {
    const strict = { ...paletteRules, apca: { onBlack: { 4: 80 } } }
    const failures = apcaFailures(generateScale('#F3A512', strict, 'p3'), strict, 'amber')
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatch(/^amber 4: Lc 7\d\.\d on black, below 80$/)
  })
})
