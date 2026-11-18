/**
 * The variables module: computes the Utopia primitives with utopia-core (the same maths as the
 * CSS), the letter spacing primitives from the typography config's letter spacing scale, and the
 * colour primitives from the palette generator, plus the `Fluid tokens` groups that alias the type,
 * letter spacing and space primitives in Min and Max modes, and turns them into a spec that
 * apply-variables.figma.js writes into Figma. Where they go is the figma variables config
 * (defineFigmaVariables) and the palette's `figma` settings.
 */
import { calculateSpaceScale, calculateTypeScale } from 'utopia-core'
import type { UtopiaSpaceConfig, UtopiaTypeConfig } from 'utopia-core'

import { oklchToRgb } from '../palette/colour'
import type { PaletteColour } from '../palette/palette'
import type { PaletteFigma } from '../palette/types'
import { buildColourScopesSpec, type ColourScopeRule } from './colour-scopes'
import { figmaScript, type FileGuard } from './inline'

/** Which Figma variables code writes, and where they live. Variables are matched by name. */
export interface FigmaVariablesConfig {
  /** Font size primitives, one variable per Utopia type step in each group. */
  type: { collection: string; minGroup: string; maxGroup: string }
  /** Letter spacing primitives in px, one per type step. Must share the type collection. */
  letterSpacing: { collection: string; minGroup: string; maxGroup: string }
  /** Space primitives, one per Utopia space size in each group, plus fixed sizes at both viewports. */
  space: {
    collection: string
    minGroup: string
    maxGroup: string
    fixed: Readonly<Record<string, number>>
  }
  /**
   * The fluid tokens designers bind to: each aliases the @min primitive in the Min mode and the
   * @max one in the Max mode, with scopes, code syntax (the CSS variable) and a description.
   */
  fluid: {
    collection: string
    modes: { min: string; max: string }
    fontSizeGroup: string
    letterSpacingGroup: string
    spaceGroup: string
    /** Utopia's one-up pairs (S—M); Min is the first size, Max the second. */
    pairsGroup: string
    /** Utopia's custom pairs, from the space config's customSizes. */
    customPairsGroup: string
    /** Named pairs for hand-written CSS variables: name → Utopia pair and code syntax. */
    namedPairs: Readonly<Record<string, { pair: string; codeSyntax: string }>>
  }
  /**
   * Optional: the scopes of colour variables Figma owns, such as the semantic colours, by
   * collection and group. The plugin sets only their scopes (colour-scopes.ts).
   */
  colourScopes?: readonly ColourScopeRule[]
}

/** Checks the config and returns it. */
export function defineFigmaVariables<const T extends FigmaVariablesConfig>(config: T): T {
  if (config.letterSpacing.collection !== config.type.collection) {
    throw new Error('Letter spacing and font size primitives must share a collection')
  }
  if (config.colourScopes) buildColourScopesSpec(config.colourScopes)
  return config
}

export type VariableType = 'FLOAT' | 'STRING' | 'BOOLEAN' | 'COLOR'

export interface FigmaColour {
  r: number
  g: number
  b: number
  a: number
}

export type PlainValue = number | string | boolean | FigmaColour

/** A value for one mode: plain, or an alias to a variable in `collection` (default: the same one). */
export type ModeValue = PlainValue | { aliasOf: string; collection?: string }

interface EntryMeta {
  name: string
  type: VariableType
  /** Written when given; a new variable without them gets none, as primitives have. */
  scopes?: string[]
  /** The WEB code syntax, the CSS variable without `--`. */
  codeSyntax?: string
  description?: string
}

/**
 * A plain value or (`aliasOf`) an alias to another variable in the same collection, both in the
 * default mode; or (`modes`) a value for each named mode.
 */
export type VariableEntry = EntryMeta &
  ({ value: PlainValue } | { aliasOf: string } | { modes: Record<string, ModeValue> })

export interface VariablesSpec {
  /** Colour values are only written when the file's documentColorProfile is this. */
  colorProfile?: string
  collections: {
    name: string
    /** The collection's modes, created when missing. Without them, only the default mode is written. */
    modes?: string[]
    /** Stop instead of creating the collection when it's missing. */
    required?: boolean
    /** Groups whose variables all come from code: any other variable in them is reported. */
    managedGroups: string[]
    variables: VariableEntry[]
  }[]
}

/** 5 decimal places: well inside Figma's 32-bit floats and the 0.0005 compare tolerance. */
const roundColour = (c: FigmaColour): FigmaColour => {
  const r5 = (x: number) => Math.round(x * 100000) / 100000
  return { r: r5(c.r), g: r5(c.g), b: r5(c.b), a: r5(c.a) }
}

/** The palette as colour variables: values in the file's colour profile, refs as aliases. */
export function paletteVariables(
  palette: PaletteColour[],
  where: PaletteFigma,
): VariablesSpec['collections'][number] {
  const gamut = where.colorProfile === 'DISPLAY_P3' ? 'p3' : 'srgb'
  const name = (group: string, step: string) => `${where.group}/${group}/${step}`
  return {
    name: where.collection,
    managedGroups: [...new Set(palette.map((c) => `${where.group}/${c.group}`))],
    variables: palette.map((c) =>
      c.aliasOf
        ? {
            name: name(c.group, c.name),
            type: 'COLOR',
            scopes: [...where.scopes],
            aliasOf: name(c.aliasOf.group, c.aliasOf.name),
          }
        : {
            name: name(c.group, c.name),
            type: 'COLOR',
            scopes: [...where.scopes],
            value: roundColour({ ...oklchToRgb(c.colour, gamut), a: c.colour.alpha ?? 1 }),
          },
    ),
  }
}

type TypeConfig = UtopiaTypeConfig
type SpaceConfig = UtopiaSpaceConfig

/** A description for a fluid value: px at the two viewports, to 2 decimal places. */
export function fluidDescription(min: number, max: number, minWidth: number, maxWidth: number) {
  const px = (x: number) => `${+x.toFixed(2) || 0}px`
  return px(min) === px(max)
    ? `${px(min)} at every viewport.`
    : `Fluid: ${px(min)} at ${minWidth}px wide, ${px(max)} at ${maxWidth}px wide.`
}

/** Letter spacing in px for a font size: em times size, to 3 decimal places. */
export function letterSpacingPx(em: number, fontSize: number): number {
  return Math.round(em * fontSize * 1000) / 1000 || 0
}

export function buildVariablesSpec(
  type: TypeConfig,
  space: SpaceConfig,
  where: FigmaVariablesConfig,
  letterSpacing: Readonly<Record<number, number>>,
  palette: VariablesSpec['collections'][number] | null = null,
  /** The file colour profile the palette's values are for (the palette's `figma.colorProfile`). */
  colorProfile?: string,
): VariablesSpec {
  const typeSteps = calculateTypeScale(type).sort((a, b) => a.step - b.step)
  if (where.letterSpacing.collection !== where.type.collection) {
    throw new Error('Letter spacing and font size primitives must share a collection')
  }
  const missing = typeSteps.filter((s) => letterSpacing[s.step] === undefined).map((s) => s.step)
  if (missing.length) {
    throw new Error(
      `letterSpacingScale has no value for type steps ${missing.join(', ')}. Add them to the typography config's letter spacing rule.`,
    )
  }
  const spaceScale = calculateSpaceScale(space)
  const spaceSizes = spaceScale.sizes
  const float = (name: string, value: number) => ({
    name,
    type: 'FLOAT' as const,
    scopes: [],
    value,
  })
  const fixed = Object.entries(where.space.fixed)

  return {
    ...(palette && colorProfile ? { colorProfile } : {}),
    collections: [
      ...(palette ? [palette] : []),
      {
        name: where.type.collection,
        managedGroups: [
          where.type.minGroup,
          where.type.maxGroup,
          where.letterSpacing.minGroup,
          where.letterSpacing.maxGroup,
        ],
        variables: typeSteps.flatMap((s) => [
          float(`${where.type.minGroup}/Step ${s.step}`, s.minFontSize),
          float(`${where.type.maxGroup}/Step ${s.step}`, s.maxFontSize),
          float(
            `${where.letterSpacing.minGroup}/Step ${s.step}`,
            letterSpacingPx(letterSpacing[s.step], s.minFontSize),
          ),
          float(
            `${where.letterSpacing.maxGroup}/Step ${s.step}`,
            letterSpacingPx(letterSpacing[s.step], s.maxFontSize),
          ),
        ]),
      },
      {
        name: where.space.collection,
        managedGroups: [where.space.minGroup, where.space.maxGroup],
        variables: [
          ...spaceSizes.flatMap((s) => [
            float(`${where.space.minGroup}/${s.label.toUpperCase()}`, s.minSize),
            float(`${where.space.maxGroup}/${s.label.toUpperCase()}`, s.maxSize),
          ]),
          ...fixed.flatMap(([label, value]) => [
            float(`${where.space.minGroup}/${label}`, value),
            float(`${where.space.maxGroup}/${label}`, value),
          ]),
        ],
      },
      fluidTokens(type, space, where, letterSpacing, typeSteps, spaceScale),
    ],
  }
}

/**
 * `Fluid tokens`: font size, letter spacing, space and space pairs, each aliasing the @min
 * primitive in the Min mode and the @max one in the Max mode (a pair: its first size in Min, its
 * second in Max), with scopes, code syntax and a description.
 */
function fluidTokens(
  type: TypeConfig,
  space: SpaceConfig,
  where: FigmaVariablesConfig,
  letterSpacing: Readonly<Record<number, number>>,
  typeSteps: ReturnType<typeof calculateTypeScale>,
  spaceScale: ReturnType<typeof calculateSpaceScale>,
): VariablesSpec['collections'][number] {
  const f = where.fluid
  const describe = (min: number, max: number) =>
    fluidDescription(min, max, type.minWidth, type.maxWidth)
  const minMax = (collection: string, minName: string, maxName: string) => ({
    [f.modes.min]: { aliasOf: minName, collection },
    [f.modes.max]: { aliasOf: maxName, collection },
  })
  const upper = (label: string) => label.toUpperCase()
  const sizes = new Map(spaceScale.sizes.map((s) => [s.label, s]))
  for (const [label, value] of Object.entries(where.space.fixed)) {
    sizes.set(label.toLowerCase(), { label, minSize: value, maxSize: value } as never)
  }
  const spaceName = (label: string) =>
    `${f.spaceGroup}/${label.toLowerCase() === 'zero' ? 'Zero' : upper(label)}`
  const spaceCss = (label: string) =>
    label.toLowerCase() === 'zero' ? 'none' : label.toLowerCase()
  const pair = (name: string, label: string, codeSyntax?: string) => {
    const [a, b] = label.split('-')
    const from = sizes.get(a)
    const to = sizes.get(b)
    if (!from || !to)
      throw new Error(`Space pair ${label} names a size the space scale doesn't have`)
    return {
      name,
      type: 'FLOAT' as const,
      scopes: ['GAP'],
      codeSyntax: codeSyntax ?? `space-${spaceCss(a)}-${spaceCss(b)}`,
      description: describe(from.minSize, to.maxSize),
      modes: {
        [f.modes.min]: { aliasOf: spaceName(a) },
        [f.modes.max]: { aliasOf: spaceName(b) },
      },
    }
  }
  const pairName = (group: string, label: string) =>
    `${group}/${label.split('-').map(upper).join('—')}`

  return {
    name: f.collection,
    modes: [f.modes.min, f.modes.max],
    managedGroups: [f.fontSizeGroup, f.letterSpacingGroup, f.spaceGroup, f.pairsGroup],
    variables: [
      ...typeSteps.map((s) => ({
        name: `${f.fontSizeGroup}/Step ${s.step}`,
        type: 'FLOAT' as const,
        scopes: ['FONT_SIZE'],
        codeSyntax: `font-size-${s.step}`,
        description: describe(s.minFontSize, s.maxFontSize),
        modes: minMax(
          where.type.collection,
          `${where.type.minGroup}/Step ${s.step}`,
          `${where.type.maxGroup}/Step ${s.step}`,
        ),
      })),
      ...typeSteps.map((s) => ({
        name: `${f.letterSpacingGroup}/Step ${s.step}`,
        type: 'FLOAT' as const,
        scopes: ['LETTER_SPACING'],
        codeSyntax: `letter-spacing-${s.step}`,
        description: `${describe(
          letterSpacingPx(letterSpacing[s.step], s.minFontSize),
          letterSpacingPx(letterSpacing[s.step], s.maxFontSize),
        )} In CSS: ${letterSpacing[s.step]}em, which scales with the font size.`,
        modes: minMax(
          where.letterSpacing.collection,
          `${where.letterSpacing.minGroup}/Step ${s.step}`,
          `${where.letterSpacing.maxGroup}/Step ${s.step}`,
        ),
      })),
      ...[...sizes.values()].map((s) => ({
        name: spaceName(s.label),
        type: 'FLOAT' as const,
        scopes: ['GAP'],
        codeSyntax: `space-${spaceCss(s.label)}`,
        description: describe(s.minSize, s.maxSize),
        modes: minMax(
          where.space.collection,
          `${where.space.minGroup}/${spaceName(s.label).split('/').pop()}`,
          `${where.space.maxGroup}/${spaceName(s.label).split('/').pop()}`,
        ),
      })),
      ...spaceScale.oneUpPairs.map((p) => pair(pairName(f.pairsGroup, p.label), p.label)),
      ...spaceScale.customPairs.map((p) => pair(pairName(f.customPairsGroup, p.label), p.label)),
      ...Object.entries(f.namedPairs).map(([name, named]) =>
        pair(name, named.pair, named.codeSyntax),
      ),
    ],
  }
}

/** The use_figma script for variables. */
export function buildVariablesScript(
  spec: VariablesSpec,
  dryRun: boolean,
  guard: FileGuard,
): string {
  return figmaScript('apply-variables.figma.js', 'applyVariables', spec, dryRun, guard)
}
