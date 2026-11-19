import { describe, expect, it } from 'vitest'

import {
  applySemanticsDiff,
  buildDiffScript,
  buildDiffSpec,
  buildExportScript,
  buildExportSpec,
  buildFigmaPlugin,
  describeDiff,
  fingerprint,
  formatExport,
  type SemanticsDiff,
  type VariablesSpec,
} from '../src/index'
import { FILE, inFile } from './file-guard'

interface Variable {
  id: string
  name: string
  variableCollectionId: string
  resolvedType: 'COLOR' | 'FLOAT'
  valuesByMode: Record<string, unknown>
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

/** A small file: code-owned primitives, Colours (Light, Dark) and Fluid tokens (Min, Max). */
function mockFile() {
  const collections: Collection[] = []
  const variables: Variable[] = []
  let ids = 0
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
    values: unknown[],
    extra: Partial<Variable> = {},
  ) => {
    const v: Variable = {
      id: `v${ids++}`,
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
  const remove = (v: Variable) => {
    variables.splice(variables.indexOf(v), 1)
    const c = collections.find((x) => x.id === v.variableCollectionId)!
    c.variableIds.splice(c.variableIds.indexOf(v.id), 1)
  }
  const alias = (v: Variable) => ({ type: 'VARIABLE_ALIAS', id: v.id })

  const primitives = collection('Primitives', ['Primitives'])
  const amber = variable(primitives, 'primitive/colors/amber/6', 'COLOR', [
    { r: 0.9, g: 0.6, b: 0.1, a: 1 },
  ])
  const ink = variable(primitives, 'primitive/colors/general/black', 'COLOR', [
    { r: 0, g: 0, b: 0, a: 1 },
  ])
  const colours = collection('Colours', ['Light', 'Dark'])
  const level1 = variable(
    colours,
    'Typography/level-1-default',
    'COLOR',
    [alias(ink), alias(amber)],
    {
      codeSyntax: { WEB: 'color-level-1-default' },
    },
  )
  const heading = variable(colours, 'Typography/heading-1-default', 'COLOR', [alias(level1)], {
    description: 'Headings',
  })
  const surface = variable(colours, 'Surface/surface-body', 'COLOR', [
    { r: 0.1, g: 0.1, b: 0.1, a: 1 },
  ])
  const fluid = collection('Fluid tokens', ['Min', 'Max'])
  const step1 = variable(fluid, 'Font size/Step 1', 'FLOAT', [21.6, 25.3])
  const button = variable(fluid, 'Buttons/solid-large-font-size', 'FLOAT', [alias(step1)])
  const gap = variable(fluid, 'Buttons/solid-large-gap', 'FLOAT', [8, 12])

  const figma = {
    root: { documentColorProfile: 'DISPLAY_P3' },
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async () => variables,
      getVariableByIdAsync: async (id: string) => variables.find((v) => v.id === id) ?? null,
      getVariableCollectionByIdAsync: async (id: string) =>
        collections.find((c) => c.id === id) ?? null,
    },
  }
  return {
    figma,
    collections,
    variable,
    remove,
    alias,
    collection,
    v: { amber, ink, level1, heading, surface, step1, button, gap },
    c: { primitives, colours, fluid },
  }
}

const owned: VariablesSpec = {
  collections: [
    {
      name: 'Primitives',
      variables: [
        { name: 'primitive/colors/amber/6', type: 'COLOR', value: '#000' },
        { name: 'primitive/colors/general/black', type: 'COLOR', value: '#000' },
      ],
    },
    { name: 'Fluid tokens', variables: [{ name: 'Font size/Step 1', type: 'FLOAT', value: 0 }] },
  ],
} as unknown as VariablesSpec

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(inFile(figma as object))
}

/** The file Export writes now, as text. */
async function exportText(figma: unknown): Promise<string> {
  const { tokens } = await run(buildExportScript(buildExportSpec(owned), FILE), figma)
  return formatExport(tokens)
}

async function check(figma: unknown, committed: string, collections?: string[]) {
  const script = buildDiffScript(buildDiffSpec(owned, committed, { collections }), FILE)
  return (await run(script, figma)) as SemanticsDiff
}

describe('Figma against the committed file', () => {
  it('finds nothing when the committed file is what Export writes (both sides hash alike)', async () => {
    const { figma } = mockFile()
    const committed = await exportText(figma)
    const diff = await check(figma, committed)
    expect(diff.changed).toEqual([])
    expect(diff.missing).toEqual([])
    expect(diff.order).toEqual({ tokens: {} })
    const { text, summary } = applySemanticsDiff(committed, diff)
    expect(text).toBe(committed)
    expect(describeDiff(summary)).toContain('Nothing to pull')
  })

  it('returns only what changed, and pulling it gives exactly what Export writes', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    // A changed value, a changed description, a new token, a removed one, a new collection.
    file.v.surface.valuesByMode[`${file.c.colours.id}m1`] = { r: 0.05, g: 0.05, b: 0.05, a: 1 }
    file.v.heading.description = 'Page headings'
    file.variable(file.c.colours, 'Typography/level-2-default', 'COLOR', [file.alias(file.v.ink)])
    file.remove(file.v.gap)
    const sizes = file.collection('Sizes', ['S', 'M'])
    file.variable(sizes, 'Hero/hero-default-min', 'FLOAT', [450, 760])
    const expected = await exportText(file.figma)

    const diff = await check(file.figma, committed)
    // Only the changes travel: not the unchanged tokens.
    expect(diff.changed.map((e) => e.path.join('/'))).toEqual([
      'Colours/Typography/heading-1-default',
      'Colours/Typography/level-2-default',
      'Colours/Surface/surface-body',
      'Sizes/$extensions',
      'Sizes/Hero/hero-default-min',
    ])
    expect(diff.missing).toHaveLength(3)
    const { text, summary } = applySemanticsDiff(committed, diff)
    expect(text).toBe(expected)
    expect(summary).toEqual({
      added: [
        'Colours/Typography/level-2-default',
        'Sizes/$extensions',
        'Sizes/Hero/hero-default-min',
      ],
      changed: ['Colours/Typography/heading-1-default', 'Colours/Surface/surface-body'],
      removed: ['Fluid tokens/Buttons/solid-large-gap'],
      reordered: ['(the collections)'],
    })
  })

  it('pulls a reorder, which changes no value', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    file.c.colours.variableIds.reverse()
    const diff = await check(file.figma, committed)
    expect(diff.changed).toEqual([])
    const { text, summary } = applySemanticsDiff(committed, diff)
    expect(text).toBe(await exportText(file.figma))
    expect(summary.reordered).toEqual(['Colours'])
  })

  it('checks only some collections, and pulls only those', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    file.v.surface.description = 'The page'
    file.v.button.description = 'Large buttons'
    const diff = await check(file.figma, committed, ['Colours'])
    expect(diff.changed.map((e) => e.path.join('/'))).toEqual(['Colours/Surface/surface-body'])
    const { text, summary } = applySemanticsDiff(committed, diff)
    expect(summary.changed).toEqual(['Colours/Surface/surface-body'])
    // Fluid tokens is as committed, the button's description not pulled.
    expect(JSON.parse(text)['Fluid tokens']).toEqual(JSON.parse(committed)['Fluid tokens'])
    expect(JSON.parse(text).Colours).toEqual(JSON.parse(await exportText(file.figma)).Colours)
  })

  it('pulls the removal of a whole collection when checking only that one', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    file.remove(file.v.button)
    file.remove(file.v.gap)
    const diff = await check(file.figma, committed, ['Fluid tokens'])
    const { text, summary } = applySemanticsDiff(committed, diff)
    expect(text).toBe(await exportText(file.figma))
    expect(summary.removed).toContain('Fluid tokens/Buttons/solid-large-gap')
  })

  it('refuses a result that changed after Figma made it', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    file.v.surface.description = 'The page'
    const diff = await check(file.figma, committed)
    const copied = JSON.parse(JSON.stringify(diff)) as SemanticsDiff
    ;(copied.changed[0].value as { $description: string }).$description = 'The pages'
    expect(() => applySemanticsDiff(committed, copied)).toThrow(/checksum/)
    // Reformatting the JSON is fine: only the content counts.
    expect(() =>
      applySemanticsDiff(committed, JSON.parse(JSON.stringify(diff, null, 4))),
    ).not.toThrow()
  })

  it('refuses a result made from another version of the file', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    const diff = await check(file.figma, committed)
    expect(() => applySemanticsDiff(`${committed} `, diff)).toThrow(/another version/)
  })

  it('keeps the use_figma script small: hashes, not the file', async () => {
    const { figma } = mockFile()
    const spec = buildDiffSpec(owned, await exportText(figma))
    expect(spec.committed.paths).toBeUndefined()
    expect(spec.committed.hashes.every((h) => /^[0-9a-z]{1,11}$/.test(h))).toBe(true)
  })

  it('names the hashes for the plugin', async () => {
    const { figma } = mockFile()
    const print = fingerprint(await exportText(figma), { paths: true })
    expect(print.paths).toContain('Colours/Typography/level-1-default')
    expect(print.paths).toHaveLength(print.hashes.length)
  })
})

describe('the plugin’s dry run', () => {
  it('reports what Figma has that the committed file doesn’t', async () => {
    const file = mockFile()
    const committed = await exportText(file.figma)
    file.v.heading.description = 'Page headings'
    file.remove(file.v.gap)
    const code = buildFigmaPlugin(
      { diff: buildDiffSpec(owned, committed, { paths: true }) },
      FILE,
      new Date(0),
    )
    const message = await new Promise<{ reports: { semantics: SemanticsDiff } }>((resolve) => {
      const figma = inFile({
        ...file.figma,
        showUI: () => {},
        closePlugin: () => {},
        ui: { postMessage: resolve, onmessage: null },
      })
      new Function('figma', code)(figma)
    })
    expect(message.reports.semantics.summary).toEqual({
      added: [],
      changed: ['Colours/Typography/heading-1-default'],
      removed: ['Fluid tokens/Buttons/solid-large-gap'],
      reordered: [],
    })
  })
})
