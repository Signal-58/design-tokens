/**
 * The token config: one file per project, `design-tokens/tokens.config.ts`, that brings the module
 * configs together with what belongs to the project as a whole.
 */
import path from 'node:path'

import { createJiti } from 'jiti'

import { fileKeyFrom, isFileKey } from './figma/file-key'
import type { FileGuard } from './figma/inline'
import { buildTextStyleSpec, type TextStyleSpec } from './figma/text-styles'
import {
  buildVariablesSpec,
  paletteVariables,
  type FigmaVariablesConfig,
  type VariablesSpec,
} from './figma/variables'
import type { UtopiaConfig } from './fluid/utopia'
import { buildPalette } from './palette/palette'
import type { PaletteConfig } from './palette/types'
import type { BuildConfig } from './style-dictionary'
import type { BreakpointsConfig, FluidToolConfig } from './responsive/breakpoints'
import type { TypographyConfig } from './type/rules'

export interface TokensConfig {
  /** The project, as people call it: `S58 Marketing`. */
  name: string
  figma: {
    /**
     * The Figma file the tokens belong to, from its URL: figma.com/design/<file key>/…. The plugin
     * and the use_figma scripts refuse to run on any other file, or while this is empty.
     */
    fileKey: string
    /**
     * Optional: the file's name, which the guard checks only when Figma doesn't give the plugin the
     * file's key. Renaming the file then stops the plugin until this is updated.
     */
    fileName?: string
    /** The project's development plugin. The id must be unique among the plugins a designer imports. */
    plugin: {
      name: string
      id: string
      /** Where manifest.json and code.js go, from the project root. Default `design-tokens/figma-plugin`. */
      dir?: string
    }
  }
  palette: PaletteConfig
  utopia: UtopiaConfig
  typography: TypographyConfig
  figmaVariables: FigmaVariablesConfig
  /** Optional: breakpoint SCSS and CSS custom properties. */
  breakpoints?: BreakpointsConfig
  /** Where `_fluid.scss` goes. Without it, no helper is written. */
  fluidTool?: FluidToolConfig
  /** Where `s58-tokens generate` writes the DTCG files, from the project root. Default `design-tokens/generated`. */
  generated?: string
  /** What `s58-tokens build` writes with Style Dictionary, and the Figma exports it reads. */
  build?: BuildConfig
  /**
   * The project's formatter, run on each built file (not the DTCG files) through stdin. `{file}`
   * is the file's path, so the formatter picks the right parser and config:
   * `['oxfmt', '--stdin-filepath={file}']`.
   */
  format?: { command: readonly string[] }
  check?: {
    /** APCA floor misses the project accepts, as `<scale> <step> on <white|black>`: `amber 6 on white`. */
    allowApcaMisses?: readonly string[]
  }
}

/** Checks the config and returns it. The CLI reads it as the default export of tokens.config.ts. */
export function defineTokens<const T extends TokensConfig>(config: T): T {
  if (!/^[a-z0-9-]+$/.test(config.figma.plugin.id)) {
    throw new Error(
      `figma.plugin.id must be lowercase letters, digits and hyphens: ${config.figma.plugin.id}`,
    )
  }
  const { fileKey } = config.figma
  if (fileKey && !isFileKey(fileKey)) {
    let hint = ''
    try {
      hint = ` Use '${fileKeyFrom(fileKey)}'.`
    } catch {
      // Not a link either: the message says what a key looks like.
    }
    throw new Error(
      `figma.fileKey must be the file's key, the part of its link after /design/: ${fileKey}.${hint}`,
    )
  }
  return config
}

export const DEFAULT_CONFIG_PATH = 'design-tokens/tokens.config.ts'

/**
 * Loads a project's token config with jiti, so it can stay TypeScript and import the other configs.
 * `fresh` skips jiti's caches, for watch mode.
 */
export async function loadTokensConfig(
  file: string = DEFAULT_CONFIG_PATH,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<TokensConfig> {
  const absolute = path.resolve(file)
  const jiti = createJiti(import.meta.url, { moduleCache: !fresh, fsCache: !fresh })
  const config = await jiti.import<TokensConfig>(absolute, { default: true })
  if (!config || typeof config !== 'object' || !('palette' in config)) {
    throw new Error(`${file} must export a token config (defineTokens) as its default export`)
  }
  return config
}

/** The Figma file the project's plugin and use_figma scripts may touch. */
export function fileGuardFor(config: TokensConfig): FileGuard {
  const { fileKey, fileName } = config.figma
  return { project: config.name, fileKey, ...(fileName ? { fileName } : {}) }
}

/** The variables module's spec for a project: Utopia, letter spacing and colour primitives. */
export function variablesSpecFor(config: TokensConfig): VariablesSpec {
  const { utopia, figmaVariables, typography, palette } = config
  return buildVariablesSpec(
    utopia.type,
    utopia.space,
    figmaVariables,
    typography.letterSpacingScale,
    paletteVariables(buildPalette(palette), palette.figma),
    palette.figma.colorProfile,
  )
}

/** The text styles module's spec for a project, for all roles or the ones named. */
export function textStylesSpecFor(config: TokensConfig, roles?: readonly string[]): TextStyleSpec {
  const all = config.typography.roles
  if (roles) {
    const unknown = roles.filter((r) => !(r in all))
    if (unknown.length) throw new Error(`Unknown roles: ${unknown.join(', ')}`)
  }
  const picked = roles ? Object.fromEntries(roles.map((r) => [r, all[r]])) : all
  return buildTextStyleSpec(picked, config.typography.fonts, config.typography.figma)
}
