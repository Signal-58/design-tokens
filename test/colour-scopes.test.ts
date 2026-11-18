import { describe, expect, it } from 'vitest'

import {
  buildColourScopesScript,
  buildColourScopesSpec,
  buildFigmaPlugin,
  colourScopesSpecFor,
  defineFigmaVariables,
  type ColourScopeRule,
  type FigmaVariablesConfig,
  type TokensConfig,
} from '../src/index'
import { FILE, inFile } from './file-guard'

interface MockVariable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: string
  scopes: string[]
  valuesByMode: Record<string, unknown>
}

/** A stand-in for Figma with a semantic `Colours` collection and a `Primitives` one. */
function mockFigma() {
  const collections = [
    { id: 'c1', name: 'Colours', modes: [{ modeId: 'light', name: 'Light' }] },
    { id: 'c2', name: 'Primitives', modes: [{ modeId: 'p', name: 'Primitives' }] },
  ]
  const variable = (
    id: string,
    name: string,
    scopes: string[],
    collection = 'c1',
    type = 'COLOR',
  ): MockVariable => ({
    id,
    name,
    variableCollectionId: collection,
    resolvedType: type,
    scopes,
    valuesByMode: { light: { type: 'VARIABLE_ALIAS', id: 'p1' } },
  })
  const variables = [
    variable('v1', 'Typography/heading-1-default', ['TEXT_FILL']),
    variable('v2', 'Typography/body-1-default', ['TEXT_FILL']),
    variable('v3', 'Typography/validation-error-icon', ['SHAPE_FILL', 'STROKE_COLOR']),
    variable('v4', 'Typography/text-link-bg', ['FRAME_FILL', 'SHAPE_FILL']),
    variable('v5', 'Typographyish/other', ['TEXT_FILL']),
    variable('v6', 'Surface/page', ['FRAME_FILL', 'SHAPE_FILL']),
    variable('v7', 'Typography/size', ['FONT_SIZE'], 'c1', 'FLOAT'),
    variable('p1', 'Typography/brand', ['ALL_FILLS'], 'c2'),
  ]
  const figma = {
    root: { name: 'Test file' },
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async (type?: string) =>
        variables.filter((v) => !type || v.resolvedType === type),
    },
  }
  const scopesOf = (id: string) => variables.find((v) => v.id === id)!.scopes
  return { figma, variables, scopesOf }
}

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(inFile(figma as object))
}

const rules: ColourScopeRule[] = [
  {
    collection: 'Colours',
    group: 'Typography',
    scopes: ['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
  },
  { collection: 'Colours', group: 'Typography/text-link-bg', scopes: ['FRAME_FILL', 'SHAPE_FILL'] },
]
const spec = buildColourScopesSpec(rules)

describe('buildColourScopesSpec', () => {
  it('refuses scopes Figma would reject on a colour', () => {
    const rule = (scopes: string[]) =>
      [{ collection: 'Colours', group: 'Typography', scopes }] as never
    expect(() => buildColourScopesSpec(rule(['FONT_SIZE']))).toThrow(
      "FONT_SIZE isn't a colour scope",
    )
    expect(() => buildColourScopesSpec(rule(['ALL_SCOPES', 'TEXT_FILL']))).toThrow(
      'ALL_SCOPES already includes every other scope',
    )
    expect(() => buildColourScopesSpec(rule(['ALL_FILLS', 'TEXT_FILL']))).toThrow(
      'ALL_FILLS already includes TEXT_FILL',
    )
    expect(() => buildColourScopesSpec(rule([]))).not.toThrow()
  })

  it('refuses a group given twice', () => {
    expect(() => buildColourScopesSpec([rules[0], { ...rules[0], scopes: ['TEXT_FILL'] }])).toThrow(
      'given twice',
    )
  })
})

describe('the config', () => {
  const base = {
    type: { collection: 'Type', minGroup: 'a', maxGroup: 'b' },
    letterSpacing: { collection: 'Type', minGroup: 'c', maxGroup: 'd' },
  } as unknown as FigmaVariablesConfig

  it('checks colourScopes when it loads', () => {
    expect(() =>
      defineFigmaVariables({
        ...base,
        colourScopes: [
          { collection: 'Colours', group: 'Typography', scopes: ['FONT_SIZE' as never] },
        ],
      }),
    ).toThrow("FONT_SIZE isn't a colour scope")
  })

  it('gives the plugin no module when it sets none', () => {
    const config = (figmaVariables: FigmaVariablesConfig) => ({ figmaVariables }) as TokensConfig
    expect(colourScopesSpecFor(config(base))).toBeUndefined()
    expect(colourScopesSpecFor(config({ ...base, colourScopes: rules }))).toEqual(spec)
  })
})

describe('applying colour scopes', () => {
  it('reports in a dry run and changes nothing', async () => {
    const mock = mockFigma()
    const report = await run(buildColourScopesScript(spec, true, FILE), mock.figma)
    expect(report.updated).toEqual([
      {
        name: 'Colours: Typography/heading-1-default',
        from: 'TEXT_FILL',
        to: 'TEXT_FILL, SHAPE_FILL, STROKE_COLOR',
      },
      {
        name: 'Colours: Typography/body-1-default',
        from: 'TEXT_FILL',
        to: 'TEXT_FILL, SHAPE_FILL, STROKE_COLOR',
      },
      {
        name: 'Colours: Typography/validation-error-icon',
        from: 'SHAPE_FILL, STROKE_COLOR',
        to: 'TEXT_FILL, SHAPE_FILL, STROKE_COLOR',
      },
    ])
    // The more specific rule already matches the link background.
    expect(report.unchanged).toBe(1)
    expect(report.warnings).toEqual([])
    expect(mock.scopesOf('v1')).toEqual(['TEXT_FILL'])
  })

  it('sets only the scopes, only for colours its rules cover, and a rerun changes nothing', async () => {
    const mock = mockFigma()
    const before = JSON.stringify(mock.variables.map((v) => [v.name, v.valuesByMode]))
    await run(buildColourScopesScript(spec, false, FILE), mock.figma)
    expect(mock.scopesOf('v1')).toEqual(['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'])
    expect(mock.scopesOf('v3')).toEqual(['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'])
    expect(mock.scopesOf('v4')).toEqual(['FRAME_FILL', 'SHAPE_FILL'])
    expect(mock.scopesOf('v5')).toEqual(['TEXT_FILL'])
    expect(mock.scopesOf('v6')).toEqual(['FRAME_FILL', 'SHAPE_FILL'])
    expect(mock.scopesOf('v7')).toEqual(['FONT_SIZE'])
    expect(mock.scopesOf('p1')).toEqual(['ALL_FILLS'])
    expect(JSON.stringify(mock.variables.map((v) => [v.name, v.valuesByMode]))).toBe(before)

    const again = await run(buildColourScopesScript(spec, false, FILE), mock.figma)
    expect(again.updated).toEqual([])
    expect(again.unchanged).toBe(4)
  })

  it('reports a rule that matches nothing', async () => {
    const mock = mockFigma()
    const missing = buildColourScopesSpec([
      { collection: 'Colors', group: 'Typography', scopes: ['TEXT_FILL'] },
      { collection: 'Colours', group: 'Logo', scopes: ['SHAPE_FILL'] },
    ])
    const report = await run(buildColourScopesScript(missing, true, FILE), mock.figma)
    expect(report.warnings).toEqual([
      'Colour scopes for Colors / Typography: no variable collection named "Colors".',
      'Colour scopes for Colours / Logo: no colour variable under "Logo" in "Colours".',
    ])
  })

  it('refuses another project’s file', async () => {
    const mock = mockFigma()
    await expect(
      run(buildColourScopesScript(spec, false, FILE), {
        ...mock.figma,
        fileKey: 'SomeoneElsesFile00000000',
      }),
    ).rejects.toThrow("This isn't Test Project's Figma file")
    expect(mock.scopesOf('v1')).toEqual(['TEXT_FILL'])
  })
})

describe('the plugin with the colour scopes module', () => {
  it('reports colour scopes in the dry run and sets them on Apply', async () => {
    const mock = mockFigma()
    const messages: { type: string; reports?: { colourScopes?: { updated: unknown[] } } }[] = []
    const ui = {
      postMessage: (msg: (typeof messages)[number]) => messages.push(msg),
      onmessage: undefined as undefined | ((msg: { type: string }) => Promise<void> | void),
    }
    new Function('figma', buildFigmaPlugin({ colourScopes: spec }, FILE))({
      ...inFile(mock.figma),
      ui,
      showUI: () => {},
      closePlugin: () => {},
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(messages[0].reports!.colourScopes!.updated).toHaveLength(3)
    expect(mock.scopesOf('v1')).toEqual(['TEXT_FILL'])
    await ui.onmessage!({ type: 'apply' })
    expect(mock.scopesOf('v1')).toEqual(['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'])
  })
})
