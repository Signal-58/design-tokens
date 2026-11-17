/**
 * The build: the generated primitives and Figma's semantic exports, as one DTCG tree, through Style
 * Dictionary into the files the project lists in `build.files`.
 */
import fs from 'node:fs'
import path from 'node:path'

import StyleDictionary from 'style-dictionary'
import type { DesignTokens, Format, TransformedToken } from 'style-dictionary/types'

import type { TokensConfig } from '../config'
import { figmaColourTokens, figmaFluidTokens, mergeTrees } from '../dtcg/figma'
import { generateDtcg, type DtcgTree } from '../dtcg/generate'
import { formatOklch } from '../palette/colour'
import { cssNameOf, packageFormats, type FormatArgs } from './formats'

export interface BuildFile {
  /** From the project root. */
  destination: string
  /** A package format (`s58/scss/colour-primitives`) or one of the project's `build.formats`. */
  format: string
  options?: Record<string, unknown>
}

export type ProjectFormat = (args: FormatArgs) => string | Promise<string>

export interface BuildConfig {
  /** Figma's exports of the semantics Figma owns, from the project root. */
  semantics?: {
    /** The colour export for each mode: `{ light: '…/light.tokens.json', dark: '…' }`. */
    colours?: Readonly<Record<string, string>>
    /** The Fluid tokens export (one mode) and its semantic groups, in output order. */
    fluid?: { file: string; groups: readonly string[] }
  }
  files: readonly BuildFile[]
  formats?: Readonly<Record<string, ProjectFormat>>
}

const readJson = (root: string, file: string) =>
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) as Record<string, unknown>

/** The whole token tree the build reads: generated primitives plus Figma's semantics. */
export function tokenTree(config: TokensConfig, root = process.cwd()): DtcgTree {
  const semantics = config.build?.semantics
  return mergeTrees(
    ...Object.values(generateDtcg(config)),
    ...Object.entries(semantics?.colours ?? {}).map(([mode, file]) =>
      figmaColourTokens(readJson(root, file), mode),
    ),
    ...(semantics?.fluid
      ? [figmaFluidTokens(readJson(root, semantics.fluid.file), semantics.fluid.groups)]
      : []),
  )
}

/** Every file in `build.files`, formatted, without writing anything. */
export async function buildTokenFiles(
  config: TokensConfig,
  root = process.cwd(),
): Promise<{ destination: string; output: string }[]> {
  const build = config.build
  if (!build) return []
  const formats: Record<string, Format['format']> = {}
  for (const [name, format] of Object.entries({ ...packageFormats, ...build.formats })) {
    formats[name] = (args) => format(args as unknown as FormatArgs)
  }
  const sd = new StyleDictionary({
    tokens: tokenTree(config, root) as DesignTokens,
    usesDtcg: true,
    log: { verbosity: 'silent', warnings: 'disabled' },
    hooks: {
      formats,
      transforms: {
        's58/name/code-syntax': {
          type: 'name',
          transform: (t: TransformedToken) => cssNameOf(t) ?? t.path.join('-'),
        },
        's58/color/oklch': {
          type: 'value',
          filter: (t: TransformedToken) => {
            const v = t.original.$value as { colorSpace?: string } | undefined
            return t.$type === 'color' && typeof v === 'object' && v?.colorSpace === 'oklch'
          },
          transform: (t: TransformedToken) => {
            const { components, alpha } = t.original.$value as {
              components: [number, number, number]
              alpha?: number
            }
            const [l, c, h] = components
            return formatOklch({ l, c, h, alpha })
          },
        },
      },
    },
    platforms: {
      s58: {
        transforms: ['s58/name/code-syntax', 's58/color/oklch'],
        files: build.files.map((file) => ({
          destination: file.destination,
          format: file.format,
          options: { ...file.options, tokens: config },
        })),
      },
    },
  })
  const outputs = (await sd.formatPlatform('s58')) as { destination?: string; output: unknown }[]
  return outputs.map((o) => ({ destination: String(o.destination), output: String(o.output) }))
}
