import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  buildCodeSyntaxScript,
  buildCodeSyntaxSpec,
  builtFiles,
  checkTokens,
  codeSyntaxFor,
  covers,
  dtcgFiles,
  initProject,
  isExcluded,
  kebab,
  loadTokensConfig,
  type TokensConfig,
  type VariablesSpec,
} from '../src/index'
import { FILE, inFile } from './file-guard'

describe('the naming and exclusion rules', () => {
  it('kebab-cases names', () => {
    expect(kebab('Two thirds')).toBe('two-thirds')
    expect(kebab('Whole—Half')).toBe('whole-half')
    expect(kebab('Step -1')).toBe('step-1')
    expect(kebab('Café @min')).toBe('cafe-min')
  })

  it('matches a collection, a group or one token, by whole path parts', () => {
    expect(covers('Sizes', 'Sizes', 'Hero/m')).toBe(true)
    expect(covers('Fluid tokens/Layout/Hero', 'Fluid tokens', 'Layout/Hero/Default')).toBe(true)
    expect(covers('Fluid tokens/Layout', 'Fluid tokens', 'Layouts/x')).toBe(false)
    expect(covers('Fluid tokens/Grid/Half', 'Fluid tokens', 'Grid/Half')).toBe(true)
    expect(isExcluded(['Sizes'], 'Fluid tokens', 'Grid/Half')).toBe(false)
    expect(isExcluded(undefined, 'Sizes', 'Hero/m')).toBe(false)
  })

  it('names by the most specific rule, with an empty prefix allowed', () => {
    const rules = {
      'Fluid tokens/Grid': 'grid',
      'Fluid tokens/Grid/Whole': 'full',
      'Fluid tokens/Forms': '',
    }
    expect(codeSyntaxFor(rules, 'Fluid tokens', 'Grid/Two thirds')).toBe('grid-two-thirds')
    expect(codeSyntaxFor(rules, 'Fluid tokens', 'Grid/Whole')).toBe('full')
    expect(codeSyntaxFor(rules, 'Fluid tokens', 'Forms/form-input-height')).toBe(
      'form-input-height',
    )
    expect(codeSyntaxFor(rules, 'Colours', 'Typography/x')).toBeUndefined()
  })
})

// ─── The plugin's code syntax module ───────────────────────────────────────

interface Variable {
  id: string
  name: string
  variableCollectionId: string
  codeSyntax: { WEB?: string }
  setVariableCodeSyntax: (platform: string, value: string) => void
}

function mockFigma() {
  const collections = [
    { id: 'c0', name: 'Fluid tokens' },
    { id: 'c1', name: 'Sizes' },
  ]
  const variables: Variable[] = []
  const add = (collection: string, name: string, web?: string) => {
    const v: Variable = {
      id: `v${variables.length}`,
      name,
      variableCollectionId: collection,
      codeSyntax: web ? { WEB: web } : {},
      setVariableCodeSyntax(_platform, value) {
        v.codeSyntax = { WEB: value }
      },
    }
    variables.push(v)
    return v
  }
  add('c0', 'Space size/S', 'space-s') // code-owned
  add('c0', 'Grid/Two thirds')
  add('c0', 'Grid/Gutter', 'gutter') // named by a designer
  add('c0', 'Grid/Half')
  add('c0', 'Border width/1')
  add('c0', 'Layout/x') // no rule covers Layout
  add('c0', 'Grid/Whole—Half')
  add('c0', 'Grid/Whole Half') // same kebab as the one above
  add('c1', 'Hero/m') // excluded
  const figma = {
    variables: {
      getLocalVariableCollectionsAsync: async () => collections,
      getLocalVariablesAsync: async () => variables,
    },
  }
  return { figma, variables }
}

const ownedSpec = {
  collections: [
    { name: 'Fluid tokens', variables: [{ name: 'Space size/S', type: 'FLOAT', value: 0 }] },
  ],
} as unknown as VariablesSpec

const rules = { 'Fluid tokens/Grid': 'grid', 'Fluid tokens/Border width': 'border-width' }

async function run(script: string, figma: unknown) {
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor
  return new AsyncFunction('figma', script)(inFile(figma as object))
}

describe('the code syntax module', () => {
  const spec = buildCodeSyntaxSpec(ownedSpec, rules, ['Sizes'])

  it('dry-runs: names what no one has named, by the rules, and changes nothing', async () => {
    const { figma, variables } = mockFigma()
    const report = await run(buildCodeSyntaxScript(spec, true, FILE), figma)
    expect(report.named).toEqual([
      { name: 'Fluid tokens: Grid/Two thirds', to: 'grid-two-thirds' },
      { name: 'Fluid tokens: Grid/Half', to: 'grid-half' },
      { name: 'Fluid tokens: Border width/1', to: 'border-width-1' },
      { name: 'Fluid tokens: Grid/Whole—Half', to: 'grid-whole-half' },
    ])
    expect(report.unnamed).toEqual(['Fluid tokens: Layout/x'])
    expect(report.designOnly).toBe(1)
    expect(report.unchanged).toBe(1)
    expect(report.warnings).toEqual([
      'Fluid tokens: Grid/Whole Half would be grid-whole-half, which Grid/Whole—Half already has, so it was left unnamed',
    ])
    expect(variables.find((v) => v.name === 'Grid/Half')!.codeSyntax).toEqual({})
  })

  it('applies: writes the names, never changing one a designer set', async () => {
    const { figma, variables } = mockFigma()
    await run(buildCodeSyntaxScript(spec, false, FILE), figma)
    const web = (name: string) => variables.find((v) => v.name === name)!.codeSyntax.WEB
    expect(web('Grid/Half')).toBe('grid-half')
    expect(web('Grid/Gutter')).toBe('gutter')
    expect(web('Space size/S')).toBe('space-s')
    expect(web('Hero/m')).toBeUndefined()
  })

  it('gives the same names as the rules in code', async () => {
    const { figma } = mockFigma()
    const report = await run(buildCodeSyntaxScript(spec, true, FILE), figma)
    for (const { name, to } of report.named as { name: string; to: string }[]) {
      const [collection, variable] = name.split(': ')
      expect(codeSyntaxFor(rules, collection, variable)).toBe(to)
    }
  })

  it('refuses a rule with no group', () => {
    expect(() => buildCodeSyntaxSpec(ownedSpec, { ' ': 'x' })).toThrow('a rule has no group')
  })
})

// ─── The build ─────────────────────────────────────────────────────────────

const PACKAGE = path.resolve(__dirname, '..')
const roots: string[] = []
afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

const token = (modes: Record<string, unknown>, extra: Record<string, unknown> = {}) => {
  const { web, scopes = ['GAP'] } = extra as { web?: string; scopes?: string[] }
  return {
    $type: 'number',
    $value: Object.values(modes)[0],
    $extensions: {
      ...(web ? { 'com.figma.codeSyntax': { WEB: web } } : {}),
      'com.figma.scopes': scopes,
      ...(Object.keys(modes).length > 1 ? { 'com.signal58.modes': modes } : {}),
    },
  }
}
const collection = (modes: string[], tree: Record<string, unknown>) => ({
  $extensions: { 'com.signal58.collection': { modes, defaultMode: modes[0] } },
  ...tree,
})

/** A pulled file for the starter project: the kinds of semantic S58 Marketing has. */
const pulled = {
  $extensions: { 'com.signal58.export': { format: 1, colorProfile: 'DISPLAY_P3' } },
  'Fluid tokens': collection(['Min', 'Max'], {
    Grid: {
      Gutter: token(
        { Min: '{Space primitives.Space @min.S}', Max: '{Space primitives.Space @max.M}' },
        { web: 'grid-gutter' },
      ),
      Same: token({
        Min: '{Fluid tokens.Space size pairs.S—M}',
        Max: '{Fluid tokens.Space size pairs.S—M}',
      }),
      Hairline: token({ Min: 1, Max: 1 }, { scopes: ['STROKE_FLOAT'] }),
    },
    Layout: {
      Hero: token({ Min: '{Sizes.Hero.m}', Max: '{Sizes.Hero.m}' }, { web: 'layout-hero' }),
    },
    'Line height': {
      Default: token({
        Min: '{Library.Line height.Default}',
        Max: '{Library.Line height.Default}',
      }),
    },
  }),
  'Layout blocks': collection(['Default', 'Flush'], {
    Blocks: {
      'default-block': token(
        {
          Default: '{Fluid tokens.Space size pairs.L—XL}',
          Flush: '{Fluid tokens.Space size pairs.L—XL}',
        },
        { web: 'layout-block-default-block' },
      ),
      'block-start': token(
        { Default: '{Layout blocks.Blocks.default-block}', Flush: 0 },
        { web: 'layout-block-block-start' },
      ),
    },
  }),
  Sizes: collection(['M', 'L'], { Hero: { m: token({ M: 760, L: 1000 }) } }),
  Effects: collection(['Mode 1'], {
    Opacity: { half: token({ 'Mode 1': 0.5 }, { web: 'opacity-half', scopes: ['OPACITY'] }) },
  }),
}

async function starter(semantics: Record<string, unknown>, withFile = true) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 's58-every-semantic-'))
  roots.push(root)
  fs.mkdirSync(path.join(root, 'node_modules/@signal58'), { recursive: true })
  fs.symlinkSync(PACKAGE, path.join(root, 'node_modules/@signal58/design-tokens'), 'dir')
  initProject({ name: 'Acme' }, { root })
  fs.mkdirSync(path.join(root, 'design-tokens/figma'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'design-tokens/figma/semantics.tokens.json'),
    JSON.stringify(pulled),
  )
  const loaded = await loadTokensConfig(path.join(root, 'design-tokens/tokens.config.ts'))
  const config: TokensConfig = {
    ...loaded,
    build: {
      ...loaded.build!,
      semantics: { file: 'design-tokens/figma/semantics.tokens.json', ...semantics },
      files: [
        ...loaded.build!.files,
        ...(withFile
          ? [{ destination: 'src/styles/tokens/_semantic.scss', format: 's58/scss/semantics' }]
          : []),
      ],
    },
  }
  return { root, config }
}

const opted = {
  exclude: ['Fluid tokens/Line height', 'Sizes'],
  codeSyntax: { 'Fluid tokens/Grid': 'grid' },
  modes: { 'Layout blocks': { Flush: "[data-block-spacing='flush']" } },
}

async function semanticCss(config: TokensConfig, root: string) {
  const file = (await builtFiles(config, root)).find((f) =>
    f.destination.endsWith('_semantic.scss'),
  )
  return file!.output
}

describe('every semantic in code', () => {
  it('writes clamps, var()s, rem sizes and unitless numbers, and resolves through excluded tokens', async () => {
    const { root, config } = await starter(opted)
    const css = await semanticCss(config, root)
    expect(css).toMatch(/--grid-gutter: clamp\([\d.]+rem, [-\d.]+rem \+ [\d.]+vw, [\d.]+rem\);/)
    expect(css).toContain('--layout-hero: 47.5rem;')
    expect(css).toContain('--opacity-half: 0.5;')
    expect(css).not.toContain('line-height')
    // Unnamed in Figma, so not written until the plugin names them and they're pulled again.
    expect(css).not.toContain('grid-same')
  })

  it('writes one block per mode, with the selectors the config gives', async () => {
    const { root, config } = await starter(opted)
    const css = await semanticCss(config, root)
    expect(css).toContain(':root {\n')
    expect(css).toContain('  --layout-block-default-block: var(--space-l-xl);')
    expect(css).toContain('  --layout-block-block-start: var(--layout-block-default-block);')
    expect(css).toContain(
      "[data-block-spacing='flush'] {\n  /* Layout blocks: Blocks (Flush) */\n  --layout-block-default-block: var(--space-l-xl);\n  --layout-block-block-start: 0;\n}",
    )
  })

  it('stops on a reference it can’t follow, unless the token is excluded', async () => {
    const { root, config } = await starter({ ...opted, exclude: ['Sizes'] })
    await expect(builtFiles(config, root)).rejects.toThrow(
      'Fluid tokens: Line height/Default references {Library.Line height.Default}',
    )
  })

  it('stops on a mode with no selector', async () => {
    const { root, config } = await starter({ ...opted, modes: {} })
    await expect(builtFiles(config, root)).rejects.toThrow(
      'Layout blocks has a mode, Flush, with no selector',
    )
  })

  it('changes nothing until the project opts in', async () => {
    const { root, config } = await starter({}, false)
    const files = await builtFiles(config, root)
    expect(files.some((f) => f.destination.endsWith('_semantic.scss'))).toBe(false)
  })
})

describe('the check, once a project opts in', () => {
  async function problems(semantics: Record<string, unknown>, withFile = true) {
    const { root, config } = await starter(semantics, withFile)
    for (const { destination, output } of [
      ...dtcgFiles(config),
      ...(await builtFiles(config, root)),
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, destination)), { recursive: true })
      fs.writeFileSync(path.join(root, destination), output)
    }
    return checkTokens(config, root)
  }

  it('lists the semantics that are neither named nor excluded, and exclusions that match nothing', async () => {
    const { problems: found } = await problems({ ...opted, exclude: [...opted.exclude, 'Nope'] })
    expect(found).toEqual([
      'build.semantics.exclude has "Nope", which matches nothing in design-tokens/figma/semantics.tokens.json. Was it renamed in Figma?',
      "2 semantics have no code syntax and aren't excluded: Fluid tokens/Grid/Same, Fluid tokens/Grid/Hairline. Name them with the plugin (build.semantics.codeSyntax), in Figma, or exclude them; then pull again.",
    ])
  })

  it('asks for the semantics format and the selectors', async () => {
    const semantics = {
      ...opted,
      exclude: [...opted.exclude, 'Fluid tokens/Grid/Same', 'Fluid tokens/Grid/Hairline'],
    }
    expect((await problems(semantics, false)).problems).toEqual([
      "No file in build.files uses the 's58/scss/semantics' format, so the named semantics don't reach CSS.",
    ])
  })

  it('only notes what doesn’t reach code before the project opts in', async () => {
    const result = await problems({}, false)
    expect(result.problems).toEqual([])
    expect(result.notes).toEqual([
      "4 of Figma's semantics have no code syntax, so they don't reach code. Set build.semantics.exclude and codeSyntax to choose.",
    ])
  })
})
