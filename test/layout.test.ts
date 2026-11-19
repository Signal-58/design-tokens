import fs from 'fs'
import os from 'os'
import path from 'path'
import { calculateSpaceScale } from 'utopia-core'
import { afterAll, describe, expect, it } from 'vitest'

import {
  buildVariablesScript,
  builtFiles,
  defineLayout,
  dtcgFiles,
  initProject,
  loadTokensConfig,
  mergeCollections,
  variablesSpecFor,
  type LayoutConfig,
  type TokensConfig,
  type VariablesSpec,
} from '../src/index'
import { FILE, inFile } from './file-guard'

const PACKAGE = path.resolve(__dirname, '..')
const roots: string[] = []
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

/** The layout S58 Marketing's file has, in the starter's collections. */
const layout = (palette: string) =>
  defineLayout({
    viewport: {
      collection: 'Space primitives',
      min: 'Layout @min/viewport',
      max: 'Layout @max/viewport',
    },
    borderWidths: {
      collection: palette,
      minGroup: 'primitive/borderWidth/@min',
      maxGroup: 'primitive/borderWidth/@max',
      widths: { 0: 'zero', 1: '3xs', 2: 'xs' },
    },
    lineHeights: {
      collection: 'Type primitives',
      minGroup: 'Line height @min',
      maxGroup: 'Line height @max',
      values: { Default: { rule: 'copy', step: 0 } },
    },
    sizes: [
      {
        collection: 'Space primitives',
        group: 'Hero',
        values: { Compact: 450, Small: 550, XLarge: 1600 },
        css: { prefix: 'hero-size', omit: ['Compact'] },
      },
    ],
  })

async function starter(pulled?: unknown, extra: Partial<LayoutConfig> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 's58-layout-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'node_modules/@signal58'), { recursive: true })
  fs.symlinkSync(PACKAGE, path.join(root, 'node_modules/@signal58/design-tokens'), 'dir')
  initProject({ name: 'Acme' }, { root })
  const loaded = await loadTokensConfig(path.join(root, 'design-tokens/tokens.config.ts'))
  const files = [
    ...loaded.build!.files,
    { destination: 'src/styles/tokens/_layout.scss', format: 's58/scss/layout' },
  ]
  if (pulled) {
    fs.mkdirSync(path.join(root, 'design-tokens/figma'), { recursive: true })
    fs.writeFileSync(
      path.join(root, 'design-tokens/figma/semantics.tokens.json'),
      JSON.stringify(pulled),
    )
    files.push({ destination: 'src/styles/tokens/_semantic.scss', format: 's58/scss/semantics' })
  }
  const config: TokensConfig = {
    ...loaded,
    layout: { ...layout(loaded.palette.figma.collection), ...extra },
    build: {
      ...loaded.build!,
      ...(pulled
        ? { semantics: { file: 'design-tokens/figma/semantics.tokens.json', exclude: [] } }
        : {}),
      files,
    },
  }
  return { root, config }
}

const collectionOf = (spec: VariablesSpec, name: string) =>
  spec.collections.find((c) => c.name === name)!

describe('defineLayout', () => {
  it('rejects misspelt keys and sizes css.omit doesn’t have', () => {
    expect(() =>
      defineLayout({ viewport: { collection: 'x', min: 'a', max: 'b', mid: 'c' } } as never),
    ).toThrow(/mid/)
    expect(() =>
      defineLayout({
        sizes: [
          { collection: 'x', group: 'Hero', values: { S: 1 }, css: { prefix: 'h', omit: ['M'] } },
        ],
      }),
    ).toThrow("layout.sizes: Hero's css.omit names no size: M")
  })
})

describe('the layout primitives in Figma', () => {
  it('adds each to the collection it names, under its own managed groups', async () => {
    const { config } = await starter()
    const spec = variablesSpecFor(config)
    const palette = collectionOf(spec, config.palette.figma.collection)
    expect(palette.managedGroups).toContain('primitive/borderWidth/@min')
    expect(palette.variables.find((v) => v.name === 'primitive/borderWidth/@max/1')).toEqual({
      name: 'primitive/borderWidth/@max/1',
      type: 'FLOAT',
      scopes: [],
      aliasOf: 'Space @max/3XS',
      aliasCollection: 'Space primitives',
    })
    expect(palette.variables.find((v) => v.name === 'primitive/borderWidth/@min/0')).toMatchObject({
      aliasOf: 'Space @min/Zero',
    })
    const space = collectionOf(spec, 'Space primitives')
    expect(space.variables.find((v) => v.name === 'Layout @max/viewport')).toMatchObject({
      value: config.utopia.viewport.maxWidth,
    })
    expect(space.variables.find((v) => v.name === 'Hero/Compact')).toMatchObject({ value: 450 })
    expect(space.managedGroups).toEqual(['Space @min', 'Space @max', 'Hero'])
    const type = collectionOf(spec, 'Type primitives')
    expect(type.variables.find((v) => v.name === 'Line height @min/Default')).toMatchObject({
      value: 1.19,
    })
    expect(type.variables.find((v) => v.name === 'Line height @max/Default')).toMatchObject({
      value: 1.19,
    })
  })

  it('stops on a border width that isn’t a space size, or a line height rule that doesn’t exist', async () => {
    const { config } = await starter()
    const bad = (layout: Partial<LayoutConfig>) =>
      variablesSpecFor({ ...config, layout: { ...config.layout, ...layout } })
    expect(() =>
      bad({ borderWidths: { ...config.layout!.borderWidths!, widths: { 1: '99xs' } } }),
    ).toThrow("layout.borderWidths: 1 is 99xs, which isn't a space size")
    expect(() =>
      bad({
        lineHeights: {
          ...config.layout!.lineHeights!,
          values: { Default: { rule: 'nope', step: 0 } },
        },
      }),
    ).toThrow('uses the rule nope')
  })

  it('refuses two configs writing the same variable', () => {
    const c = (name: string) => ({
      name: 'X',
      managedGroups: [],
      variables: [{ name, type: 'FLOAT' as const, value: 1 }],
    })
    expect(mergeCollections([c('a'), c('b')])[0].variables).toHaveLength(2)
    expect(() => mergeCollections([c('a'), c('a')])).toThrow('X: two configs write a')
  })

  it('writes an alias to a variable a later collection creates in the same run', async () => {
    const { config } = await starter()
    // Only what this test needs: the border widths come before the space scale they alias.
    const full = variablesSpecFor(config)
    const spec: VariablesSpec = {
      collections: [
        {
          ...collectionOf(full, config.palette.figma.collection),
          variables: collectionOf(full, config.palette.figma.collection).variables.filter(
            (v) => v.type === 'FLOAT',
          ),
        },
        collectionOf(full, 'Space primitives'),
      ],
    }
    const collections: {
      id: string
      name: string
      defaultModeId: string
      modes: { modeId: string; name: string }[]
    }[] = []
    const variables: {
      id: string
      name: string
      variableCollectionId: string
      resolvedType: string
      scopes: string[]
      codeSyntax: Record<string, string>
      description: string
      valuesByMode: Record<string, unknown>
      setValueForMode: (m: string, v: unknown) => void
    }[] = []
    const figma = {
      variables: {
        getLocalVariableCollectionsAsync: async () => collections,
        getLocalVariablesAsync: async () => variables,
        createVariableCollection: (name: string) => {
          const c = {
            id: `c${collections.length}`,
            name,
            defaultModeId: `m${collections.length}`,
            modes: [] as { modeId: string; name: string }[],
          }
          c.modes.push({ modeId: c.defaultModeId, name: 'Mode 1' })
          collections.push(c)
          return c
        },
        createVariable: (name: string, collection: { id: string }, type: string) => {
          const v = {
            id: `v${variables.length}`,
            name,
            variableCollectionId: collection.id,
            resolvedType: type,
            scopes: [],
            codeSyntax: {},
            description: '',
            valuesByMode: {} as Record<string, unknown>,
            setValueForMode(m: string, value: unknown) {
              v.valuesByMode[m] = value
            },
          }
          variables.push(v)
          return v
        },
        createVariableAlias: (v: { id: string }) => ({ type: 'VARIABLE_ALIAS', id: v.id }),
      },
    }
    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
    const report = await new AsyncFunction('figma', buildVariablesScript(spec, false, FILE))(
      inFile(figma),
    )
    expect(report.warnings).toEqual([])
    const width = variables.find((v) => v.name === 'primitive/borderWidth/@min/1')!
    const target = variables.find((v) => v.name === 'Space @min/3XS')!
    expect(Object.values(width.valuesByMode)).toEqual([{ type: 'VARIABLE_ALIAS', id: target.id }])
  })
})

describe('the layout sizes in CSS', () => {
  it('generates the sizes a group builds into CSS, in px, without the omitted ones', async () => {
    const { root, config } = await starter()
    const dtcg = dtcgFiles(config).find((f) => f.destination.endsWith('layout.tokens.json'))!
    expect(JSON.parse(dtcg.output).layout.Hero.Small).toEqual({
      $type: 'dimension',
      $value: { value: 550, unit: 'px' },
      $extensions: { 'com.figma.codeSyntax': { WEB: 'hero-size-small' } },
    })
    const css = (await builtFiles(config, root)).find((f) =>
      f.destination.endsWith('_layout.scss'),
    )!
    expect(css.output).toContain(
      ':root {\n  /* Hero */\n  --hero-size-small: 550px;\n  --hero-size-xlarge: 1600px;\n}',
    )
    expect(css.output).not.toContain('compact')
  })

  it('writes no layout file when nothing goes into CSS', async () => {
    const { config } = await starter(undefined, { sizes: [] })
    expect(dtcgFiles(config).some((f) => f.destination.endsWith('layout.tokens.json'))).toBe(false)
  })
})

describe('semantics that alias the layout primitives', () => {
  const token = (modes: Record<string, unknown>, web: string, scopes = ['WIDTH_HEIGHT']) => ({
    $type: 'number',
    $value: Object.values(modes)[0],
    $extensions: {
      'com.figma.codeSyntax': { WEB: web },
      'com.figma.scopes': scopes,
      'com.signal58.modes': modes,
    },
  })

  it('resolves them as code-owned, the border widths through the space scale', async () => {
    const pulled = {
      $extensions: { 'com.signal58.export': { format: 1 } },
      'Fluid tokens': {
        $extensions: { 'com.signal58.collection': { modes: ['Min', 'Max'], defaultMode: 'Min' } },
        'Border width': {
          1: token(
            {
              Min: '{Primitives.primitive.borderWidth.@min.1}',
              Max: '{Primitives.primitive.borderWidth.@max.1}',
            },
            'border-width-1',
            ['STROKE_FLOAT'],
          ),
        },
        Layout: {
          Viewport: token(
            {
              Min: '{Space primitives.Layout @min.viewport}',
              Max: '{Space primitives.Layout @max.viewport}',
            },
            'layout-viewport',
          ),
          Hero: token(
            { Min: '{Space primitives.Hero.Small}', Max: '{Space primitives.Hero.XLarge}' },
            'layout-hero',
          ),
        },
        'Line height': {
          Default: token(
            {
              Min: '{Type primitives.Line height @min.Default}',
              Max: '{Type primitives.Line height @max.Default}',
            },
            'line-height-default',
            ['LINE_HEIGHT'],
          ),
        },
      },
    }
    const { root, config } = await starter(pulled)
    expect(config.palette.figma.collection).toBe('Primitives')
    const css = (await builtFiles(config, root)).find((f) =>
      f.destination.endsWith('_semantic.scss'),
    )!
    // Through the alias to the space primitive: the starter's 3XS is the same at both ends.
    const xs3 = calculateSpaceScale(config.utopia.space).sizes.find((s) => s.label === '3xs')!
    expect(xs3.minSize).toBe(xs3.maxSize)
    expect(css.output).toContain(`--border-width-1: ${xs3.minSize / 16}rem;`)
    expect(css.output).toMatch(
      /--layout-viewport: clamp\(24\.375rem, [-\d.]+rem \+ [\d.]+vw, 96\.875rem\);/,
    )
    expect(css.output).toMatch(/--layout-hero: clamp\(34\.375rem, /)
    expect(css.output).toContain('--line-height-default: 1.19;')
  })
})
