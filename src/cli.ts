/**
 * The s58-tokens command. Run it from the project root; it reads design-tokens/tokens.config.ts
 * (or --config=<file>).
 *
 *   s58-tokens init --name="Acme" --brand=#2F5BEA   # a new project's design-tokens/ folder
 *   s58-tokens generate                               # the DTCG files in design-tokens/generated
 *   s58-tokens build                                  # generate, then every file in build.files,
 *                                                     # the breakpoints and _fluid.scss
 *   s58-tokens check                                  # read only, for CI: exits 1 on problems
 *   s58-tokens palette report                         # contrast, APCA floors, gamut fit
 *   s58-tokens figma plugin [--watch]                 # <plugin dir>/code.js, all modules
 *   s58-tokens figma script variables --dry-run [--collections=Primitives]   # use_figma
 *   s58-tokens figma script colour-scopes --dry-run
 *   s58-tokens figma script text-styles --dry-run [--roles=heading,default]
 *   s58-tokens figma script code-syntax --dry-run              # names semantics by build.semantics.codeSyntax
 *   s58-tokens figma script export [--collections=Colours]   # the semantics Figma owns, read only
 *
 * Figma's REST API can't write variables or styles on a Pro plan, so the code runs inside Figma: as
 * the project's development plugin, or through the Figma MCP's use_figma tool.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  codeSyntaxSpecFor,
  colourScopesSpecFor,
  DEFAULT_CONFIG_PATH,
  fileGuardFor,
  loadTokensConfig,
  textStylesSpecFor,
  variablesSpecFor,
  type TokensConfig,
} from './config'
import { checkTokens } from './check'
import { initProject } from './init'
import { buildColourScopesScript } from './figma/colour-scopes'
import { buildExportScript, buildExportSpec } from './figma/semantics'
import { buildCodeSyntaxScript } from './figma/code-syntax'
import { pluginManifest } from './figma/manifest'
import { buildFigmaPlugin } from './figma/plugin'
import { buildTextStylesScript } from './figma/text-styles'
import { buildVariablesScript } from './figma/variables'
import { paletteReport } from './palette/report'
import { builtFiles, dtcgFiles } from './outputs'

/** The most code the Figma MCP's use_figma tool accepts in one call. */
const USE_FIGMA_LIMIT = 50_000
/** The most a use_figma call returns. */
const USE_FIGMA_RETURN_LIMIT = 48_000

const USAGE = `Usage: s58-tokens [--config=<file>] <command>

  init --name=<project> [--brand=<colour>] [--accent=<colour>] [--neutral=<colour>]
       [--file-key=<key or link>] [--id=<plugin id>] [--out=<dir>] [--force]
                                         Write a new project's design-tokens/ configs
  generate                               Write the DTCG files (design-tokens/generated)
  build                                  Generate, then write every file the config lists
  check                                  Report files out of date with the configs, raw
                                         semantic values and APCA misses (for CI)
  palette report                         Contrast on white and black, APCA floors, gamut fit
  figma plugin [--watch]                 Build the project's Figma plugin (code.js)
  figma script <variables|colour-scopes|code-syntax|text-styles|export>
                                         A use_figma script, on stdout. export reads
                                         the semantics Figma owns; save what it returns
                                         as the pulled file (build.semantics.file)
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

async function build(config: TokensConfig): Promise<void> {
  for (const { destination, output } of [...dtcgFiles(config), ...(await builtFiles(config))]) {
    write(destination, output)
  }
}

async function check(config: TokensConfig): Promise<void> {
  const { problems, notes } = await checkTokens(config)
  for (const note of notes) process.stdout.write(`  ${note}\n`)
  if (problems.length) {
    process.stderr.write(`${problems.map((p) => `✗ ${p}`).join('\n')}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write('Tokens are in sync with the configs.\n')
}

const pluginDir = (config: TokensConfig) => config.figma.plugin.dir ?? 'design-tokens/figma-plugin'

/**
 * The manifest Figma imports. Written when missing. An existing one is left alone, except that
 * `enablePrivatePluginApi` is added when it's missing, because the file guard needs it.
 */
function ensureManifest(config: TokensConfig): void {
  const file = path.join(pluginDir(config), 'manifest.json')
  const { name, id } = config.figma.plugin
  if (fs.existsSync(file)) {
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
    if (manifest.name !== name || manifest.id !== id) {
      process.stderr.write(
        `${file} names the plugin "${manifest.name}" (${manifest.id}); the config says "${name}" (${id}).\n`,
      )
    }
    if (manifest.enablePrivatePluginApi !== true) {
      write(file, `${JSON.stringify({ ...manifest, enablePrivatePluginApi: true }, null, 2)}\n`)
    }
    return
  }
  write(file, pluginManifest(config.figma.plugin))
}

function buildPlugin(config: TokensConfig): void {
  ensureManifest(config)
  if (!config.figma.fileKey) {
    process.stderr.write(
      'figma.fileKey is empty in the token config, so the plugin will refuse to run until it is set.\n',
    )
  }
  const code = buildFigmaPlugin(
    {
      variables: variablesSpecFor(config),
      colourScopes: colourScopesSpecFor(config),
      codeSyntax: codeSyntaxSpecFor(config),
      textStyles: textStylesSpecFor(config),
      export: buildExportSpec(variablesSpecFor(config)),
    },
    fileGuardFor(config),
  )
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
    code = buildVariablesScript(spec, dryRun, fileGuardFor(config))
  } else if (module === 'colour-scopes') {
    const spec = colourScopesSpecFor(config)
    if (!spec) throw new Error('The config sets no colourScopes (figmaVariables.colourScopes).')
    code = buildColourScopesScript(spec, dryRun, fileGuardFor(config))
  } else if (module === 'text-styles') {
    code = buildTextStylesScript(
      textStylesSpecFor(config, list(option(args, 'roles'))),
      dryRun,
      fileGuardFor(config),
    )
  } else if (module === 'code-syntax') {
    const spec = codeSyntaxSpecFor(config)
    if (!spec) throw new Error('The config sets no build.semantics.codeSyntax rules.')
    code = buildCodeSyntaxScript(spec, dryRun, fileGuardFor(config))
  } else if (module === 'export') {
    code = buildExportScript(
      buildExportSpec(variablesSpecFor(config), list(option(args, 'collections'))),
      fileGuardFor(config),
    )
  } else {
    throw new Error(USAGE)
  }
  if (module === 'export') {
    process.stderr.write(
      `use_figma returns at most ${USE_FIGMA_RETURN_LIMIT} bytes. If the export is larger, run it once per collection (--collections=Colours), or use the plugin's Export button.\n`,
    )
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

  if (command === 'init') {
    const written = initProject(
      {
        name: option(argv, 'name') ?? '',
        id: option(argv, 'id'),
        fileKey: option(argv, 'file-key'),
        brand: option(argv, 'brand'),
        accent: option(argv, 'accent'),
        neutral: option(argv, 'neutral'),
        out: option(argv, 'out'),
      },
      { force: argv.includes('--force') },
    )
    for (const file of written) process.stdout.write(`  -> ${file}\n`)
    process.stdout.write('Next: s58-tokens build, then s58-tokens figma plugin.\n')
    return
  }
  if (command === 'generate') {
    for (const { destination, output } of dtcgFiles(await loadTokensConfig(configFile))) {
      write(destination, output)
    }
    return
  }
  if (command === 'check') return check(await loadTokensConfig(configFile))
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
