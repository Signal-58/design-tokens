/**
 * The s58-tokens command. Run it from the project root; it reads design-tokens/tokens.config.ts
 * (or --config=<file>).
 *
 *   s58-tokens build                                  # breakpoints and _fluid.scss
 *   s58-tokens palette report                         # contrast, APCA floors, gamut fit
 *   s58-tokens figma plugin [--watch]                 # <plugin dir>/code.js, all modules
 *   s58-tokens figma script variables --dry-run [--collections=Primitives]   # use_figma
 *   s58-tokens figma script text-styles --dry-run [--roles=heading,default]
 *
 * Figma's REST API can't write variables or styles on a Pro plan, so the code runs inside Figma: as
 * the project's development plugin, or through the Figma MCP's use_figma tool.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DEFAULT_CONFIG_PATH,
  loadTokensConfig,
  textStylesSpecFor,
  variablesSpecFor,
  type TokensConfig,
} from './config'
import { buildFigmaPlugin } from './figma/plugin'
import { buildTextStylesScript } from './figma/text-styles'
import { buildVariablesScript } from './figma/variables'
import { paletteReport } from './palette/report'
import {
  generateBreakpointsCssScss,
  generateBreakpointsScss,
  generateFluidToolScss,
  utopiaScssFrom,
} from './responsive/breakpoints'

/** The most code the Figma MCP's use_figma tool accepts in one call. */
const USE_FIGMA_LIMIT = 50_000

const USAGE = `Usage: s58-tokens [--config=<file>] <command>

  build                                  Write the breakpoint SCSS and _fluid.scss
  palette report                         Contrast on white and black, APCA floors, gamut fit
  figma plugin [--watch]                 Build the project's Figma plugin (code.js)
  figma script <variables|text-styles>   A use_figma script, on stdout
      [--dry-run] [--collections=a,b] [--roles=a,b]
`

const option = (args: string[], name: string) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)

const list = (value: string | undefined) => (value ? value.split(',') : undefined)

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, contents)
  process.stdout.write(`  -> ${file}\n`)
}

function build(config: TokensConfig): void {
  const { breakpoints, fluidTool, utopia } = config
  if (!breakpoints && !fluidTool) {
    process.stdout.write('Nothing to build: the config has no breakpoints or fluidTool.\n')
    return
  }
  if (breakpoints) {
    write(breakpoints.output.scss, generateBreakpointsScss(breakpoints, utopia.viewport))
    write(breakpoints.output.css, generateBreakpointsCssScss(breakpoints))
  }
  if (fluidTool) {
    write(
      fluidTool.output,
      generateFluidToolScss(utopia.viewport, utopiaScssFrom(fluidTool.output)),
    )
  }
}

const pluginDir = (config: TokensConfig) => config.figma.plugin.dir ?? 'design-tokens/figma-plugin'

/** The manifest Figma imports. Written when missing; an existing one is left alone. */
function ensureManifest(config: TokensConfig): void {
  const file = path.join(pluginDir(config), 'manifest.json')
  const { name, id } = config.figma.plugin
  if (fs.existsSync(file)) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { name?: string; id?: string }
    if (manifest.name !== name || manifest.id !== id) {
      process.stderr.write(
        `${file} names the plugin "${manifest.name}" (${manifest.id}); the config says "${name}" (${id}).\n`,
      )
    }
    return
  }
  const manifest = {
    name,
    id,
    api: '1.0.0',
    main: 'code.js',
    editorType: ['figma'],
    documentAccess: 'dynamic-page',
    networkAccess: { allowedDomains: ['none'] },
  }
  write(file, `${JSON.stringify(manifest, null, 2)}\n`)
}

function buildPlugin(config: TokensConfig): void {
  ensureManifest(config)
  const code = buildFigmaPlugin({
    variables: variablesSpecFor(config),
    textStyles: textStylesSpecFor(config),
  })
  const file = path.join(pluginDir(config), 'code.js')
  fs.writeFileSync(file, code)
  const time = new Date().toLocaleTimeString('en-GB')
  process.stdout.write(`${time} Wrote ${file}\n`)
}

/** Rebuilds the plugin when a config file changes (and the Figma-side code, in this repository). */
function watchPlugin(configFile: string, config: TokensConfig): void {
  const output = path.resolve(pluginDir(config))
  const figmaSource = path.dirname(fileURLToPath(import.meta.url))
  const dirs = [path.dirname(path.resolve(configFile)), path.join(figmaSource, 'figma')]
  let timer: NodeJS.Timeout | undefined
  const rebuild = () => {
    clearTimeout(timer)
    timer = setTimeout(async () => {
      try {
        buildPlugin(await loadTokensConfig(configFile, { fresh: true }))
      } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      }
    }, 100)
  }
  for (const dir of dirs.filter((d) => fs.existsSync(d))) {
    fs.watch(dir, { recursive: true }, (_event, name) => {
      if (!name || path.resolve(dir, name).startsWith(output)) return
      rebuild()
    })
  }
  process.stdout.write(`Watching ${dirs.map((d) => path.relative(process.cwd(), d)).join(', ')}\n`)
}

function script(config: TokensConfig, args: string[]): void {
  const [module] = args
  const dryRun = args.includes('--dry-run')
  let code: string
  if (module === 'variables') {
    const spec = variablesSpecFor(config)
    const names = list(option(args, 'collections'))
    if (names) {
      const unknown = names.filter((n) => !spec.collections.some((c) => c.name === n))
      if (unknown.length) throw new Error(`Unknown collections: ${unknown.join(', ')}`)
      spec.collections = spec.collections.filter((c) => names.includes(c.name))
    }
    code = buildVariablesScript(spec, dryRun)
  } else if (module === 'text-styles') {
    code = buildTextStylesScript(textStylesSpecFor(config, list(option(args, 'roles'))), dryRun)
  } else {
    throw new Error(USAGE)
  }
  if (code.length > USE_FIGMA_LIMIT) {
    process.stderr.write(
      `The script is ${code.length} characters; use_figma takes ${USE_FIGMA_LIMIT}. ` +
        'Split it: variables with --collections=Primitives, text styles with --roles=heading,default. Or use the plugin.\n',
    )
  }
  process.stdout.write(code)
}

async function main(argv: string[]): Promise<void> {
  const configFile = option(argv, 'config') ?? DEFAULT_CONFIG_PATH
  const args = argv.filter((a) => !a.startsWith('--config='))
  const [command, sub, ...rest] = args

  if (command === 'build') return build(await loadTokensConfig(configFile))
  if (command === 'palette' && sub === 'report') {
    const config = await loadTokensConfig(configFile)
    process.stdout.write(`${paletteReport(config.palette)}\n`)
    return
  }
  if (command === 'figma' && sub === 'plugin') {
    const config = await loadTokensConfig(configFile)
    buildPlugin(config)
    if (rest.includes('--watch')) watchPlugin(configFile, config)
    return
  }
  if (command === 'figma' && sub === 'script')
    return script(await loadTokensConfig(configFile), rest)

  process.stderr.write(USAGE)
  process.exitCode = 1
}

main(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
