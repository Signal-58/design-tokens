/**
 * The token config: one file per project, `design-tokens/tokens.config.ts`, that brings the module
 * configs together with what belongs to the project as a whole.
 */
import path from 'node:path'

import { createJiti } from 'jiti'

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
    /** The Figma file the tokens belong to. */
    fileKey: string
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
}

/** Checks the config and returns it. The CLI reads it as the default export of tokens.config.ts. */
export function defineTokens<const T extends TokensConfig>(config: T): T {
  if (!/^[a-z0-9-]+$/.test(config.figma.plugin.id)) {
    throw new Error(
      `figma.plugin.id must be lowercase letters, digits and hyphens: ${config.figma.plugin.id}`,
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
