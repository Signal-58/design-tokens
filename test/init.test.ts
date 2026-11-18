import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'

import {
  builtFiles,
  checkTokens,
  dtcgFiles,
  initProject,
  loadTokensConfig,
  colourScopesSpecFor,
  PLACEHOLDER_COLOURS,
  textStylesSpecFor,
  variablesSpecFor,
} from '../src/index'

const PACKAGE = path.resolve(__dirname, '..')
const roots: string[] = []

/** An empty project with the package installed (linked, as pnpm would). */
function newProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 's58-tokens-init-'))
  fs.mkdirSync(path.join(root, 'node_modules/@signal58'), { recursive: true })
  fs.symlinkSync(PACKAGE, path.join(root, 'node_modules/@signal58/design-tokens'), 'dir')
  roots.push(root)
  return root
}

afterAll(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
})

describe('s58-tokens init', () => {
  it('writes a project that builds, passes the check and builds the Figma plugin', async () => {
    const root = newProject()
    const written = initProject({ name: 'Acme Rockets' }, { root })
    expect(written).toEqual([
      'design-tokens/palette.config.ts',
      'design-tokens/utopia.config.ts',
      'design-tokens/typography.config.ts',
      'design-tokens/figma-variables.config.ts',
      'design-tokens/tokens.config.ts',
      'design-tokens/figma-plugin/.gitignore',
      'design-tokens/figma-plugin/manifest.json',
    ])

    const config = await loadTokensConfig(path.join(root, 'design-tokens/tokens.config.ts'))
    expect(config.name).toBe('Acme Rockets')
    expect(config.figma.plugin).toEqual({
      name: 'Acme Rockets Tokens',
      id: 'acme-rockets-tokens-dev',
    })

    for (const { destination, output } of [
      ...dtcgFiles(config),
      ...(await builtFiles(config, root)),
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, destination)), { recursive: true })
      fs.writeFileSync(path.join(root, destination), output)
    }
    expect(await checkTokens(config, root)).toEqual({ problems: [], notes: [] })

    const colours = fs.readFileSync(
      path.join(root, 'src/styles/tokens/_color-primitives.scss'),
      'utf8',
    )
    expect(colours).toContain('--_primitive-color-brand-ref:')
    expect(colours).toContain('--_primitive-color-neutral-15:')

    const variables = variablesSpecFor(config)
    expect(variables.collections.map((c) => c.name)).toEqual([
      'Primitives',
      'Type primitives',
      'Space primitives',
      'Fluid tokens',
    ])
    const styles = textStylesSpecFor(config).styles.map((s) => s.name)
    expect(styles).toContain('Heading/Step 6')
    expect(textStylesSpecFor(config).fontVariables).toContainEqual({
      variable: 'Font family/Body',
      value: 'Inter',
      kind: 'family',
    })
  })

  it('has a breakpoints example that builds once uncommented', async () => {
    const root = newProject()
    initProject({ name: 'Acme' }, { root })
    const file = path.join(root, 'design-tokens/tokens.config.ts')
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const start = lines.indexOf('  //   breakpoints: {')
    const end = lines.indexOf('  //   },', start)
    expect(start).toBeGreaterThan(-1)
    for (let i = start; i <= end; i++) lines[i] = lines[i].replace('//   ', '')
    fs.writeFileSync(file, lines.join('\n'))

    const config = await loadTokensConfig(file)
    const built = (await builtFiles(config, root)).map((f) => f.destination)
    expect(built).toContain('src/styles/tokens/_breakpoints.scss')
    expect(built).toContain('src/styles/tokens/_breakpoints-css.scss')
  })

  it('has a colourScopes example that loads once uncommented', async () => {
    const root = newProject()
    initProject({ name: 'Acme' }, { root })
    const file = path.join(root, 'design-tokens/figma-variables.config.ts')
    const lines = fs.readFileSync(file, 'utf8').split('\n')
    const start = lines.indexOf('  // colourScopes: [')
    expect(start).toBeGreaterThan(-1)
    for (let i = start; i <= start + 2; i++) lines[i] = lines[i].replace('// ', '')
    fs.writeFileSync(file, lines.join('\n'))

    const config = await loadTokensConfig(path.join(root, 'design-tokens/tokens.config.ts'))
    expect(colourScopesSpecFor(config)?.rules).toEqual([
      {
        collection: 'Colours',
        group: 'Typography',
        scopes: ['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'],
      },
    ])
  })

  it('uses the brand colours it is given, and placeholders for the rest', () => {
    const root = newProject()
    initProject({ name: 'Acme', brand: '#E50E3F' }, { root })
    const palette = fs.readFileSync(path.join(root, 'design-tokens/palette.config.ts'), 'utf8')
    expect(palette).toContain("brand: '#E50E3F'")
    expect(palette).toContain(`accent: '${PLACEHOLDER_COLOURS.accent}'`)
    expect(palette).toContain('Placeholder colours')
  })

  it("refuses a colour it can't read", () => {
    expect(() => initProject({ name: 'Acme', brand: 'reddish' }, { root: newProject() })).toThrow(
      "--brand=reddish isn't a hex code or oklch(L C H)",
    )
  })

  it('never overwrites a file unless forced', () => {
    const root = newProject()
    initProject({ name: 'Acme' }, { root })
    expect(() => initProject({ name: 'Acme' }, { root })).toThrow(/exist already/)
    expect(initProject({ name: 'Acme Two' }, { root, force: true })).toHaveLength(7)
    expect(fs.readFileSync(path.join(root, 'design-tokens/tokens.config.ts'), 'utf8')).toContain(
      "name: 'Acme Two'",
    )
  })
})
