import { describe, expect, it } from 'vitest'

import {
  buildFigmaPlugin,
  buildVariablesScript,
  buildVariablesSpec,
  letterSpacingPx,
  defineFigmaVariables,
  type VariablesSpec,
} from '../src/index'
import { FILE, inFile } from './file-guard'

/** Where the variables go: the names in the S58 starter Figma file, with one named pair. */
const figmaVariables = defineFigmaVariables({
  type: { collection: 'Type primitives', minGroup: 'Font size @min', maxGroup: 'Font size @max' },
  letterSpacing: {
    collection: 'Type primitives',
    minGroup: 'Letter spacing @min',
    maxGroup: 'Letter spacing @max',
  },
  space: {
    collection: 'Space primitives',
    minGroup: 'Space @min',
    maxGroup: 'Space @max',
    fixed: { Zero: 0 },
  },
  fluid: {
    collection: 'Fluid tokens',
    modes: { min: 'Min', max: 'Max' },
    fontSizeGroup: 'Font size',
    letterSpacingGroup: 'Letter spacing',
    spaceGroup: 'Space size',
    pairsGroup: 'Space size pairs',
    customPairsGroup: 'Space size pairs/Custom pairs',
    namedPairs: {
      'Space size pairs/Base-1-S—M': { pair: 's-m', codeSyntax: 'base-spacing' },
      'Space size pairs/Base-2-L—XL': { pair: 'l-xl', codeSyntax: 'base-spacing-lg' },
    },
  },
})

interface MockVariable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: string
  scopes: string[]
  codeSyntax: { WEB?: string }
  description: string
  valuesByMode: Record<string, unknown>
  setValueForMode: (modeId: string, value: unknown) => void
  setVariableCodeSyntax: (platform: 'WEB', value: string) => void
}

interface MockCollection {
  id: string
  name: string
  defaultModeId: string
  modes: { modeId: string; name: string }[]
  renameMode: (modeId: string, name: string) => void
  addMode: (name: string) => string
}

type Seed = Omit<
  MockVariable,
  'id' | 'setValueForMode' | 'setVariableCodeSyntax' | 'scopes' | 'codeSyntax' | 'description'
> &
  Partial<Pick<MockVariable, 'scopes' | 'codeSyntax' | 'description'>>

/** The parts of Figma's variables API the module uses: collections, modes, variables, aliases. */
function mockFigma(collectionNames: string[], seed: Seed[] = []) {
  let nextId = 1
  const collections: MockCollection[] = []
  const makeCollection = (name: string): MockCollection => {
    const i = collections.length
    const c: MockCollection = {
      id: `c${i}`,
      name,
      defaultModeId: `m${i}`,
      modes: [{ modeId: `m${i}`, name: 'Mode 1' }],
      renameMode(modeId, newName) {
        c.modes.find((m) => m.modeId === modeId)!.name = newName
      },
      addMode(modeName) {
        const modeId = `m${i}-${c.modes.length}`
        c.modes.push({ modeId, name: modeName })
        return modeId
      },
    }
    collections.push(c)
    return c
  }
  collectionNames.forEach(makeCollection)
  const variables: MockVariable[] = []
  const make = (init: Seed): MockVariable => {
    const v: MockVariable = {
      scopes: ['ALL_SCOPES'],
      codeSyntax: {},
      description: '',
      ...init,
      id: `v${nextId++}`,
      setValueForMode(modeId, value) {
        v.valuesByMode[modeId] = value
      },
      setVariableCodeSyntax(platform, value) {
        v.codeSyntax = { ...v.codeSyntax, [platform]: value }
      },
    }
    variables.push(v)
    return v
  }
  seed.forEach(make)
  const figma = {
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async () => variables,
      createVariableCollection: (name: string) => makeCollection(name),
      createVariable: (name: string, collection: { id: string }, type: string) =>
        make({ name, variableCollectionId: collection.id, resolvedType: type, valuesByMode: {} }),
      createVariableAlias: (variable: MockVariable) => ({
        type: 'VARIABLE_ALIAS',
        id: variable.id,
      }),
    },
  }
  const collectionId = (name: string) => collections.find((c) => c.name === name)!.id
  const find = (collection: string, name: string) => {
    const c = collections.find((x) => x.name === collection)!
    return variables.find((v) => v.variableCollectionId === c.id && v.name === name)
  }
  const valueOf = (collection: string, name: string, mode?: string) => {
    const c = collections.find((x) => x.name === collection)!
    const modeId = mode ? c.modes.find((m) => m.name === mode)!.modeId : c.defaultModeId
    const value = find(collection, name)?.valuesByMode[modeId]
    const target =
      value && typeof value === 'object' && 'id' in value
        ? variables.find((v) => v.id === (value as { id: string }).id)
        : undefined
    return target ? `→ ${target.name}` : value
  }
  return { figma, variables, collections, collectionId, find, valueOf }
}

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(inFile(figma as object))
}

// A fixed scale of the tests' own, so editing utopia.config.ts never breaks them.
const viewport = { minWidth: 390, maxWidth: 1550, relativeTo: 'viewport-width' } as const
const typeConfig = {
  ...viewport,
  minFontSize: 18,
  maxFontSize: 20.25,
  minTypeScale: 1.2,
  maxTypeScale: 1.25,
  negativeSteps: 4,
  positiveSteps: 10,
}
const spaceConfig = {
  ...viewport,
  minSize: 18,
  maxSize: 20.25,
  negativeSteps: [0.75, 0.5, 0.25, 0.175, 0.125, 0.1, 0.05],
  positiveSteps: [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  customSizes: ['3xs-xs', '2xs-s', 's-l'],
}
// Steps -4 to 10, tighter as they grow.
const letterSpacing = Object.fromEntries(
  Array.from({ length: 15 }, (_, i) => [i - 4, i - 4 < 3 ? -0.01 : -0.03]),
)
// No palette here: figma-palette.test.ts covers colours.
const spec = buildVariablesSpec(typeConfig, spaceConfig, figmaVariables, letterSpacing, null)
const NAMES = ['Type primitives', 'Space primitives']

/** A mock with every variable in the spec already written, as after a first Apply. */
async function inSync() {
  const mock = mockFigma(NAMES)
  await run(buildVariablesScript(spec, false, FILE), mock.figma)
  return mock
}

describe('buildVariablesSpec', () => {
  const find = (collection: string, name: string) =>
    spec.collections.find((c) => c.name === collection)!.variables.find((v) => v.name === name) as
      | { value?: unknown }
      | undefined

  it('computes the Utopia type and space primitives', () => {
    expect(find('Type primitives', 'Font size @min/Step 0')?.value).toBe(18)
    expect(find('Type primitives', 'Font size @max/Step 6')?.value).toBe(77.2476)
    expect(find('Type primitives', 'Font size @min/Step -4')?.value).toBe(8.6806)
    expect(find('Space primitives', 'Space @min/M')?.value).toBe(27)
    expect(find('Space primitives', 'Space @max/3XL')?.value).toBe(101)
    expect(find('Space primitives', 'Space @max/Zero')?.value).toBe(0)
  })

  it('writes letter spacing as em times the font size at each viewport, in px', () => {
    expect(find('Type primitives', 'Letter spacing @min/Step 0')?.value).toBe(-0.18)
    expect(find('Type primitives', 'Letter spacing @max/Step 0')?.value).toBe(-0.202)
    expect(find('Type primitives', 'Letter spacing @min/Step 6')?.value).toBe(
      letterSpacingPx(-0.03, 53.7477),
    )
    expect(find('Type primitives', 'Letter spacing @max/Step 6')?.value).toBe(-2.317)
    expect(letterSpacingPx(0, 20)).toBe(0)
    expect(Object.is(letterSpacingPx(-0, 20), -0)).toBe(false)
  })

  it('refuses a type step with no letter spacing', () => {
    const { [10]: _, ...short } = letterSpacing
    expect(() => buildVariablesSpec(typeConfig, spaceConfig, figmaVariables, short)).toThrow(
      /no value for type steps 10/,
    )
  })

  it("doesn't write the Utopia plugin's settings collection, retired on 2026-11-17", () => {
    expect(spec.collections.map((c) => c.name)).not.toContain('Utopia')
  })
})

describe('the generated variables script', () => {
  const total = spec.collections.flatMap((c) => c.variables).length

  it('changes nothing on a dry run', async () => {
    const mock = mockFigma(NAMES)
    const report = await run(buildVariablesScript(spec, true, FILE), mock.figma)
    expect(report.created).toContainEqual({
      name: 'Fluid tokens',
      value: 'new collection (Min, Max)',
    })
    expect(report.created).toHaveLength(total + 1)
    expect(mock.variables).toHaveLength(0)
    expect(mock.collections.map((c) => c.name)).toEqual(NAMES)
  })

  it('creates Fluid tokens with Min and Max modes, aliasing the primitives in each', async () => {
    const mock = await inSync()
    const fluid = mock.collections.find((c) => c.name === 'Fluid tokens')!
    expect(fluid.modes.map((m) => m.name)).toEqual(['Min', 'Max'])
    expect(mock.valueOf('Fluid tokens', 'Font size/Step 6', 'Min')).toBe('→ Font size @min/Step 6')
    expect(mock.valueOf('Fluid tokens', 'Font size/Step 6', 'Max')).toBe('→ Font size @max/Step 6')
    expect(mock.valueOf('Fluid tokens', 'Space size pairs/S—M', 'Min')).toBe('→ Space size/S')
    expect(mock.valueOf('Fluid tokens', 'Space size pairs/S—M', 'Max')).toBe('→ Space size/M')
    expect(mock.find('Fluid tokens', 'Space size pairs/Custom pairs/2XS—S')).toBeDefined()
    expect(mock.find('Fluid tokens', 'Letter spacing/Step 0')).toMatchObject({
      scopes: ['LETTER_SPACING'],
      codeSyntax: { WEB: 'letter-spacing-0' },
    })
    expect(mock.find('Fluid tokens', 'Space size/Zero')).toMatchObject({
      scopes: ['GAP'],
      codeSyntax: { WEB: 'space-none' },
      description: '0px at every viewport.',
    })
    expect(mock.find('Space primitives', 'Space @min/M')?.scopes).toEqual([])
  })

  it('ignores 32-bit float noise, so a file in step reports nothing to do', async () => {
    const mock = await inSync()
    for (const v of mock.variables) {
      for (const [mode, value] of Object.entries(v.valuesByMode)) {
        if (typeof value === 'number') v.valuesByMode[mode] = Math.fround(value)
      }
    }
    const report = await run(buildVariablesScript(spec, true, FILE), mock.figma)
    expect(report.created).toEqual([])
    expect(report.updated).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.unchanged).toBe(total)
  })

  it('updates values, aliases, scopes, code syntax and descriptions in place', async () => {
    const mock = await inSync()
    const size = mock.find('Type primitives', 'Font size @max/Step 6')!
    size.valuesByMode[mock.collections[0].defaultModeId] = 70
    const fluid = mock.find('Fluid tokens', 'Space size pairs/S—M')!
    const max = mock.collections.find((c) => c.name === 'Fluid tokens')!.modes[1].modeId
    fluid.valuesByMode[max] = {
      type: 'VARIABLE_ALIAS',
      id: mock.find('Fluid tokens', 'Space size/L')!.id,
    }
    fluid.scopes = ['ALL_SCOPES']
    fluid.codeSyntax = {}
    fluid.description = 'old'

    const report = await run(buildVariablesScript(spec, false, FILE), mock.figma)
    expect(report.updated).toEqual([
      { name: 'Type primitives: Font size @max/Step 6', from: 70, to: 77.2476 },
      {
        name: 'Fluid tokens: Space size pairs/S—M (Max)',
        from: 'another alias',
        to: 'alias to Space size/M',
      },
      { name: 'Fluid tokens: Space size pairs/S—M scopes', from: 'ALL_SCOPES', to: 'GAP' },
      { name: 'Fluid tokens: Space size pairs/S—M code syntax', from: 'none', to: 'space-s-m' },
      {
        name: 'Fluid tokens: Space size pairs/S—M description',
        from: 'old',
        to: 'Fluid: 18px at 390px wide, 30px at 1550px wide.',
      },
    ])
    expect(mock.find('Type primitives', 'Font size @max/Step 6')).toBe(size)
    expect(mock.valueOf('Fluid tokens', 'Space size pairs/S—M', 'Max')).toBe('→ Space size/M')

    const again = await run(buildVariablesScript(spec, false, FILE), mock.figma)
    expect(again.created).toEqual([])
    expect(again.updated).toEqual([])
  })

  it('creates missing variables and reports extras without deleting them', async () => {
    const mock = await inSync()
    mock.variables.splice(mock.variables.indexOf(mock.find('Space primitives', 'Space @min/M')!), 1)
    mock.variables.push({
      ...mock.find('Type primitives', 'Font size @min/Step 0')!,
      id: 'extra',
      name: 'Font size @min/Step 14',
    })
    const report = await run(buildVariablesScript(spec, false, FILE), mock.figma)
    expect(report.created).toEqual([{ name: 'Space primitives: Space @min/M', value: 27 }])
    expect(report.figmaOnly).toEqual(['Type primitives: Font size @min/Step 14'])
    expect(mock.find('Type primitives', 'Font size @min/Step 14')).toBeDefined()
  })

  it('leaves aliases and variables of another type alone, with a warning', async () => {
    const mock = await inSync()
    const s = mock.find('Space primitives', 'Space @max/S')!
    s.valuesByMode[mock.collections[1].defaultModeId] = { type: 'VARIABLE_ALIAS', id: 'x' }
    mock.find('Space primitives', 'Space @min/M')!.resolvedType = 'STRING'
    const report = await run(buildVariablesScript(spec, false, FILE), mock.figma)
    expect(report.warnings).toEqual([
      'Space primitives: Space @max/S is an alias; left unchanged.',
      'Space primitives: Space @min/M is STRING, not FLOAT; left unchanged.',
    ])
    expect(s.valuesByMode[mock.collections[1].defaultModeId]).toEqual({
      type: 'VARIABLE_ALIAS',
      id: 'x',
    })
  })

  it('stops before writing anything when a required collection is missing', async () => {
    const mock = mockFigma(['Type primitives'])
    const missing: VariablesSpec = {
      collections: [spec.collections[0], { ...spec.collections[1], required: true }],
    }
    await expect(run(buildVariablesScript(missing, false, FILE), mock.figma)).rejects.toThrow(
      'No variable collection named "Space primitives"',
    )
    expect(mock.variables).toHaveLength(0)
  })
})

describe('the S58 Tokens plugin with the variables module', () => {
  it('reports variables in the dry run and writes them on Apply', async () => {
    const mock = await inSync()
    mock.find('Type primitives', 'Font size @max/Step 6')!.valuesByMode[
      mock.collections[0].defaultModeId
    ] = 70
    const messages: {
      type: string
      dryRun?: boolean
      reports?: { variables?: { updated: unknown[] } }
    }[] = []
    const ui = {
      postMessage: (msg: (typeof messages)[number]) => messages.push(msg),
      onmessage: undefined as undefined | ((msg: { type: string }) => Promise<void> | void),
    }
    new Function('figma', buildFigmaPlugin({ variables: spec }, FILE))({
      ...inFile(mock.figma),
      ui,
      showUI: () => {},
      closePlugin: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(messages[0]).toMatchObject({ type: 'report', dryRun: true })
    expect(messages[0].reports!.variables!.updated).toEqual([
      { name: 'Type primitives: Font size @max/Step 6', from: 70, to: 77.2476 },
    ])
    expect(mock.valueOf('Type primitives', 'Font size @max/Step 6')).toBe(70)

    await ui.onmessage!({ type: 'apply' })
    expect(messages[1]).toMatchObject({ dryRun: false })
    expect(mock.valueOf('Type primitives', 'Font size @max/Step 6')).toBe(77.2476)
  })
})
