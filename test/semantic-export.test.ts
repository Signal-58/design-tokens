import { describe, expect, it } from 'vitest'

import {
  buildExportScript,
  buildExportSpec,
  buildFigmaPlugin,
  figmaColourTokens,
  figmaFluidTokens,
  formatExport,
  pulledColourTokens,
  pulledFluidTokens,
  type VariablesSpec,
} from '../src/index'
import { FILE, inFile } from './file-guard'

type Value = unknown
interface Variable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN'
  valuesByMode: Record<string, Value>
  codeSyntax: { WEB?: string }
  scopes: string[]
  description: string
  hiddenFromPublishing: boolean
}
interface Collection {
  id: string
  name: string
  defaultModeId: string
  modes: { modeId: string; name: string }[]
  variableIds: string[]
}

/**
 * A small file like the S58 starter: code-owned primitives, a Colours collection with Light and
 * Dark, and a Fluid tokens collection whose semantic groups alias its code-owned groups. Plus a
 * library variable, as a remote alias target.
 */
function mockFile(profile = 'DISPLAY_P3') {
  const collections: Collection[] = []
  const variables: Variable[] = []
  const collection = (name: string, modes: string[]) => {
    const id = `c${collections.length}`
    const c: Collection = {
      id,
      name,
      defaultModeId: `${id}m0`,
      modes: modes.map((m, i) => ({ modeId: `${id}m${i}`, name: m })),
      variableIds: [],
    }
    collections.push(c)
    return c
  }
  const variable = (
    c: Collection,
    name: string,
    resolvedType: Variable['resolvedType'],
    values: Value[],
    extra: Partial<Variable> = {},
  ) => {
    const v: Variable = {
      id: `v${variables.length}`,
      name,
      variableCollectionId: c.id,
      resolvedType,
      valuesByMode: Object.fromEntries(c.modes.map((m, i) => [m.modeId, values[i] ?? values[0]])),
      codeSyntax: {},
      scopes: ['ALL_SCOPES'],
      description: '',
      hiddenFromPublishing: false,
      ...extra,
    }
    variables.push(v)
    c.variableIds.push(v.id)
    return v
  }
  const alias = (v: Variable) => ({ type: 'VARIABLE_ALIAS', id: v.id })

  const primitives = collection('Primitives', ['Primitives'])
  const amber = variable(primitives, 'primitive/colors/amber/6', 'COLOR', [
    { r: 0.9, g: 0.6, b: 0.1, a: 1 },
  ])
  const ink = variable(primitives, 'primitive/colors/general/black', 'COLOR', [
    { r: 0, g: 0, b: 0, a: 1 },
  ])
  const border = variable(primitives, 'primitive/borderWidth/@min/1', 'FLOAT', [1])

  const colours = collection('Colours', ['Light', 'Dark'])
  const level1 = variable(
    colours,
    'Typography/level-1-default',
    'COLOR',
    [alias(ink), alias(amber)],
    {
      codeSyntax: { WEB: 'color-level-1-default' },
      scopes: ['ALL_FILLS'],
    },
  )
  variable(colours, 'Typography/heading-1-default', 'COLOR', [alias(level1)], {
    codeSyntax: { WEB: 'color-heading-1-default' },
    description: 'Headings',
  })
  variable(colours, 'Surface/Mono/surface-body', 'COLOR', [
    { r: 0.13878, g: 0.142251, b: 0.153444, a: 1 },
  ])
  variable(colours, 'Surface/Alpha/surface-alpha-07', 'COLOR', [{ r: 1, g: 1, b: 1, a: 0.07 }], {
    hiddenFromPublishing: true,
  })

  const fluid = collection('Fluid tokens', ['Min', 'Max'])
  const step1 = variable(fluid, 'Font size/Step 1', 'FLOAT', [21.6, 25.3125])
  const xsS = variable(fluid, 'Space size pairs/XS—S', 'FLOAT', [14, 20])
  variable(fluid, 'Buttons/solid-large-font-size', 'FLOAT', [alias(step1)], {
    codeSyntax: { WEB: 'font-size-button-solid-large-font-size' },
    scopes: ['FONT_SIZE'],
  })
  variable(fluid, 'Buttons/solid-large-padding-block', 'FLOAT', [alias(xsS)], {
    codeSyntax: { WEB: 'space-button-solid-large-padding-block' },
    scopes: ['GAP'],
  })
  variable(fluid, 'Forms/form-global-input-border-width', 'FLOAT', [1.0000001])
  variable(fluid, 'Border width/1', 'FLOAT', [alias(border)])

  // A variable from a library: not local, but getVariableByIdAsync finds it.
  const library: Collection = {
    id: 'lib',
    name: 'Brand library',
    defaultModeId: 'libm0',
    modes: [{ modeId: 'libm0', name: 'Default' }],
    variableIds: [],
  }
  const remote: Variable = {
    id: 'remote',
    name: 'Line height @min/Default',
    variableCollectionId: 'lib',
    resolvedType: 'FLOAT',
    valuesByMode: { libm0: 1.4 },
    codeSyntax: {},
    scopes: [],
    description: '',
    hiddenFromPublishing: false,
  }
  variable(fluid, 'Line height/Default', 'FLOAT', [alias(remote)])
  variable(fluid, 'Line height/Gone', 'FLOAT', [{ type: 'VARIABLE_ALIAS', id: 'deleted' }])

  const figma = {
    root: { documentColorProfile: profile },
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async () => variables,
      getVariableByIdAsync: async (id: string) =>
        variables.find((v) => v.id === id) ?? (id === 'remote' ? remote : null),
      getVariableCollectionByIdAsync: async (id: string) =>
        collections.find((c) => c.id === id) ?? (id === 'lib' ? library : null),
    },
  }
  return { figma, variable, collection, collections, variables }
}

/** What the variables module writes in that file: the code-owned names. */
const owned: VariablesSpec = {
  collections: [
    {
      name: 'Primitives',
      variables: [
        { name: 'primitive/colors/amber/6', type: 'COLOR', value: '#000' },
        { name: 'primitive/colors/general/black', type: 'COLOR', value: '#000' },
      ],
    },
    {
      name: 'Fluid tokens',
      variables: [
        { name: 'Font size/Step 1', type: 'FLOAT', value: 0 },
        { name: 'Space size pairs/XS—S', type: 'FLOAT', value: 0 },
      ],
    },
  ],
} as unknown as VariablesSpec

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(inFile(figma as object))
}

// The exported tree, read loosely: each test checks the shape it reads.
// oxlint-disable-next-line no-explicit-any
type Tree = Record<string, any>

async function exported(collections?: string[], profile?: string) {
  const { figma } = mockFile(profile)
  return (await run(buildExportScript(buildExportSpec(owned, collections), FILE), figma)) as {
    tokens: Tree
    report: {
      collections: { name: string; variables: number }[]
      codeOwned: number
      warnings: string[]
    }
  }
}

describe('exportSemantics', () => {
  it('nests tokens by collection and name, and keeps aliases as references by name', async () => {
    const { tokens } = await exported()
    const heading = tokens.Colours.Typography['heading-1-default']
    expect(heading.$type).toBe('color')
    expect(heading.$value).toBe('{Colours.Typography.level-1-default}')
    expect(heading.$description).toBe('Headings')
    expect(heading.$extensions['com.figma.codeSyntax']).toEqual({ WEB: 'color-heading-1-default' })
    expect(tokens.Colours.Typography['level-1-default'].$extensions['com.signal58.modes']).toEqual({
      Light: '{Primitives.primitive.colors.general.black}',
      Dark: '{Primitives.primitive.colors.amber.6}',
    })
  })

  it('records each collection’s modes, and every mode’s value only when there are several', async () => {
    const { tokens } = await exported()
    expect(tokens.Colours.$extensions['com.signal58.collection']).toEqual({
      modes: ['Light', 'Dark'],
      defaultMode: 'Light',
    })
    expect(tokens.Primitives['primitive'].borderWidth['@min']['1']).toEqual({
      $type: 'number',
      $value: 1,
      $extensions: { 'com.figma.scopes': ['ALL_SCOPES'] },
    })
  })

  it('leaves out what the plugin writes from code, and says how much', async () => {
    const { tokens, report } = await exported()
    expect(tokens.Primitives.primitive.colors).toBeUndefined()
    expect(tokens['Fluid tokens']['Font size']).toBeUndefined()
    expect(tokens['Fluid tokens']['Space size pairs']).toBeUndefined()
    expect(report.codeOwned).toBe(4)
  })

  it('writes raw colours in the file’s profile, never P3 numbers labelled srgb', async () => {
    const p3 = await exported(['Colours'])
    expect(p3.tokens.Colours.Surface.Mono['surface-body'].$value).toEqual({
      colorSpace: 'display-p3',
      components: [0.13878, 0.14225, 0.15344],
      alpha: 1,
    })
    const srgb = await exported(['Colours'], 'SRGB')
    expect(srgb.tokens.Colours.Surface.Mono['surface-body'].$value.colorSpace).toBe('srgb')
    expect(srgb.tokens.$extensions['com.signal58.export']).toEqual({
      format: 1,
      colorProfile: 'SRGB',
    })
  })

  it('rounds raw numbers and keeps the hidden flag', async () => {
    const { tokens } = await exported()
    expect(tokens['Fluid tokens'].Forms['form-global-input-border-width'].$value).toBe(1)
    expect(
      tokens.Colours.Surface.Alpha['surface-alpha-07'].$extensions[
        'com.figma.hiddenFromPublishing'
      ],
    ).toBe(true)
  })

  it('names library variables by their collection, and warns about aliases to nothing', async () => {
    const { tokens, report } = await exported()
    expect(tokens['Fluid tokens']['Line height'].Default.$value).toBe(
      '{Brand library.Line height @min.Default}',
    )
    expect(tokens['Fluid tokens']['Line height'].Gone.$value).toBe('{(missing)}')
    expect(report.warnings).toEqual([
      "Line height/Gone aliases a variable that isn't in this file or its libraries",
    ])
  })

  it('exports only the collections asked for, and warns about unknown ones', async () => {
    const { tokens, report } = await exported(['Colours', 'Nope'])
    expect(Object.keys(tokens)).toEqual(['$extensions', 'Colours'])
    expect(report.collections).toEqual([{ name: 'Colours', variables: 4 }])
    expect(report.warnings).toContain('No collection called Nope')
  })

  it('leaves out names DTCG can’t hold, and clashing names, with a warning', async () => {
    const { figma, variable, collections } = mockFile()
    const colours = collections.find((c) => c.name === 'Colours')!
    variable(colours, 'Typography/v1.5', 'COLOR', [{ r: 0, g: 0, b: 0, a: 1 }])
    variable(colours, 'Typography/level-1-default/hover', 'COLOR', [{ r: 0, g: 0, b: 0, a: 1 }])
    const { tokens, report } = await run(
      buildExportScript(buildExportSpec(owned, ['Colours']), FILE),
      figma,
    )
    expect(tokens.Colours.Typography['v1.5']).toBeUndefined()
    expect(report.warnings).toEqual([
      "Colours: Typography/v1.5 has a name the export can't write (no dots, braces, empty parts or a leading $), so it was left out",
      "Colours: Typography/level-1-default/hover clashes with another variable's name, so it was left out",
    ])
  })

  it('refuses to run on another file', async () => {
    const { figma } = mockFile()
    await expect(
      run(
        buildExportScript(buildExportSpec(owned), { ...FILE, fileKey: 'OtherFileKey000000000000' }),
        figma,
      ),
    ).rejects.toThrow("This isn't Test Project's Figma file")
  })

  it('formats the file as the repository keeps it', () => {
    expect(formatExport({ a: { $value: 1 } })).toBe('{\n  "a": {\n    "$value": 1\n  }\n}\n')
  })
})

describe('the pulled file in the build', () => {
  /** Figma's own export of the same tokens: one file per mode, aliases out of the collection as aliasData. */
  const native = (mode: 'light' | 'dark') => ({
    Typography: {
      'level-1-default': {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0, 0, 0], alpha: 1, hex: '#000000' },
        $extensions: {
          'com.figma.codeSyntax': { WEB: 'color-level-1-default' },
          'com.figma.aliasData': {
            targetVariableName:
              mode === 'light' ? 'primitive/colors/general/black' : 'primitive/colors/amber/6',
          },
        },
      },
      'heading-1-default': {
        $type: 'color',
        $value: '{Typography.level-1-default}',
        $extensions: { 'com.figma.codeSyntax': { WEB: 'color-heading-1-default' } },
      },
    },
  })

  it('gives the same colour tree as Figma’s own export', async () => {
    const { tokens } = await exported(['Colours'])
    const colours = { Colours: { Typography: tokens.Colours.Typography } }
    expect(pulledColourTokens(colours, 'Colours', { light: 'Light', dark: 'Dark' })).toEqual({
      color: {
        ...(figmaColourTokens(native('light'), 'light').color as Tree),
        ...(figmaColourTokens(native('dark'), 'dark').color as Tree),
      },
    })
  })

  it('gives the same fluid tree as Figma’s own export, for the groups asked for', async () => {
    const { tokens } = await exported(['Fluid tokens'])
    const max = {
      Buttons: {
        'solid-large-font-size': {
          $type: 'number',
          $value: '{Font size.Step 1}',
          $extensions: {
            'com.figma.codeSyntax': { WEB: 'font-size-button-solid-large-font-size' },
          },
        },
        'solid-large-padding-block': {
          $type: 'number',
          $value: '{Space size pairs.XS—S}',
          $extensions: {
            'com.figma.codeSyntax': { WEB: 'space-button-solid-large-padding-block' },
          },
        },
      },
    }
    expect(pulledFluidTokens(tokens, 'Fluid tokens', 'Max', ['Buttons'])).toEqual(
      figmaFluidTokens(max, ['Buttons']),
    )
  })

  it('stops on a reference to a collection the build doesn’t read', async () => {
    const { tokens } = await exported(['Fluid tokens'])
    expect(() => pulledFluidTokens(tokens, 'Fluid tokens', 'Max', ['Line height'])).toThrow(
      "Fluid tokens.Line height.Default references {Brand library.Line height @min.Default}, which the build doesn't read",
    )
  })

  it('stops on a missing collection, group or mode', async () => {
    const { tokens } = await exported(['Colours'])
    expect(() => pulledFluidTokens(tokens, 'Fluid tokens', 'Max', ['Buttons'])).toThrow(
      'The pulled file has no Fluid tokens collection',
    )
    expect(() => pulledColourTokens(tokens, 'Colours', { hc: 'High contrast' })).toThrow(
      'Colours.Typography.level-1-default has no High contrast mode in the pulled file',
    )
  })
})

describe('the plugin', () => {
  it('has the Export button’s code, with what to leave out', () => {
    const code = buildFigmaPlugin({ export: buildExportSpec(owned) }, FILE, new Date(0))
    expect(code).toContain('async function exportSemantics(spec)')
    expect(code).toContain("if (msg.type === 'export') return exportFile()")
    expect(code).toContain('Primitives\\u0000primitive/colors/amber/6')
  })
})
