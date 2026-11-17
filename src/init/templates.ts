/**
 * The starter configs `s58-tokens init` writes: S58 Marketing's structure and rules (its contrast
 * ladder, chroma curve and APCA floors, its letter spacing and line height rules, its Utopia
 * settings and its Figma collection, group and role names) with placeholder brand inputs: three
 * colour scales and Inter.
 */

export interface StarterOptions {
  /** The project, as people call it: `Acme`. */
  name: string
  /** The plugin id. Default: the name in lowercase with hyphens, plus `-tokens-dev`. */
  id?: string
  /** The Figma file, when it exists: its key or its link (the key is taken from the link). */
  fileKey?: string
  /** Reference colours: hex or `oklch(L C H)`. */
  brand?: string
  accent?: string
  neutral?: string
  /** Where the built SCSS goes, from the project root. Default `src/styles/tokens`. */
  out?: string
}

/** Placeholders, to replace with the brand's colours. */
export const PLACEHOLDER_COLOURS = { brand: '#2F5BEA', accent: '#F3A512', neutral: '#8B8D92' }

export const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * A relative import in a template, written so the package build doesn't take it for one of its own
 * imports: scripts/build.mjs adds .js to every relative import it finds in the output.
 */
const local = (file: string) => `'./${file}'`

const quote = (s: string) => `'${s.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`

export function paletteConfig(o: StarterOptions): string {
  const brand = o.brand ?? PLACEHOLDER_COLOURS.brand
  const accent = o.accent ?? PLACEHOLDER_COLOURS.accent
  const neutral = o.neutral ?? PLACEHOLDER_COLOURS.neutral
  const placeholder = !o.brand || !o.accent || !o.neutral
  return `/**
 * The colour palette: the colour primitives in CSS and in Figma's \`Primitives\` collection.
 *
 * Each scale is one reference colour (a hex code or \`oklch(L C H)\`). The generator makes 15 steps,
 * lightest first, with each step's lightness solved to hit its contrast on white, so a step means
 * the same contrast in every hue. The reference sits unchanged at the step nearest its own
 * contrast. Every colour is fitted to Display P3. The rules are the package's defaults
 * (defaultPaletteRules): step 8 is 3:1 on white, step 10 is 4.5:1.
 *
 * s58-tokens palette report prints the contrast of every step, and s58-tokens check fails on an
 * APCA floor a scale misses.
 */
import { definePalette, type AlphaScale } from '@signal58/design-tokens'
${placeholder ? "\n// Placeholder colours: replace them with the brand's.\n" : ''}
export const colourScales = {
  brand: ${quote(brand)},
  accent: ${quote(accent)},
  // A neutral spread evenly from near white (step 1) to near black (step 15).
  neutral: { colour: ${quote(neutral)}, range: [0.975, 0.144] },
} as const

const alphaSteps = [0, 7, 13, 20, 27, 33, 40, 47, 53, 60, 67, 73, 80, 87, 95] as const

/** Transparent black and white, named by opacity (\`a07\` is 7%). Tint them to the neutral if wanted. */
export const alphaScales: Record<string, AlphaScale> = {
  black_alpha: { colour: { l: 0, c: 0, h: 0 }, alphas: alphaSteps },
  white_alpha: { colour: { l: 1, c: 0, h: 0 }, alphas: alphaSteps },
}

export default definePalette({
  scales: colourScales,
  general: {
    black: ['neutral', 15],
    black_pure: { l: 0, c: 0, h: 0 },
    white: ['neutral', 1],
    white_pure: { l: 1, c: 0, h: 0 },
  },
  alphas: alphaScales,
})
`
}

export function utopiaConfig(): string {
  return `/**
 * Fluid type and space, calculated with utopia-core (the same maths as utopia.fyi). These are S58
 * Marketing's settings, as a first guess: tune them with the designer at kickoff.
 */
import {
  defineUtopia,
  type UtopiaSpaceConfig,
  type UtopiaTypeConfig,
  type UtopiaViewport,
} from '@signal58/design-tokens'

/** The viewport the scales are fluid across, in px. */
export const utopiaViewport = {
  minWidth: 390,
  maxWidth: 1550,
  relativeTo: 'viewport-width',
} as const satisfies UtopiaViewport

export const utopiaTypeConfig = {
  minWidth: utopiaViewport.minWidth,
  maxWidth: utopiaViewport.maxWidth,
  minFontSize: 18,
  maxFontSize: 20.25,
  minTypeScale: 1.2,
  maxTypeScale: 1.25,
  negativeSteps: 4,
  positiveSteps: 14,
} satisfies UtopiaTypeConfig

export const utopiaSpaceConfig = {
  minWidth: utopiaViewport.minWidth,
  maxWidth: utopiaViewport.maxWidth,
  minSize: 18,
  maxSize: 20.25,
  negativeSteps: [0.75, 0.5, 0.25, 0.175, 0.125, 0.1, 0.05],
  positiveSteps: [1.5, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  customSizes: ['3xs-xs', '2xs-s', 'xs-m', 's-l', 'm-xl', 'l-2xl', 'xl-3xl'],
} satisfies UtopiaSpaceConfig

export default defineUtopia({
  viewport: utopiaViewport,
  type: utopiaTypeConfig,
  space: utopiaSpaceConfig,
})
`
}

export function typographyConfig(): string {
  return `/**
 * Typography: the font variables and text style groups the Figma plugin writes, and the letter
 * spacing and line height rules CSS and Figma both use. Inter is a placeholder: change the families
 * and weight names to the brand's fonts. Weight values are Figma style names, which differ between
 * families.
 */
import {
  buildLetterSpacingScale,
  buildLineHeightScales,
  defineTypography,
  lineHeightPercentByStep,
  stepsFrom,
  typeStepsOf,
  type LetterSpacingRule,
  type StepRule,
  type StepValues,
  type TypographyRole,
} from '@signal58/design-tokens'

import { utopiaTypeConfig } from ${local('utopia.config')}

/** The Figma collections and variable groups the text styles module reads and writes. */
export const typographyFigma = {
  fontCollection: 'Type primitives',
  fontFamilyGroup: 'Font family',
  fontWeightGroup: 'Font weight',
  sizeCollection: 'Fluid tokens',
  fontSizeGroup: 'Font size',
} as const

export const typographyFonts = {
  families: {
    Body: 'Inter',
    Heading: 'Inter',
    Brand: 'Inter',
    Logo: 'Inter',
    Mono: 'Inter',
  },
  weights: {
    Regular: 'Regular',
    Default: 'Regular',
    Thin: 'Thin',
    'Ultra Light': 'Extra Light',
    Light: 'Light',
    Medium: 'Medium',
    Bold: 'Bold',
    Black: 'Black',
  },
} as const

type FontFamilyKey = keyof typeof typographyFonts.families
type FontWeightKey = keyof typeof typographyFonts.weights

export const typeSteps: readonly number[] = typeStepsOf(utopiaTypeConfig)

/** Letter spacing in em: base + perStep × step, kept between tightest and loosest. */
export const letterSpacingRule: LetterSpacingRule = {
  base: -0.0315,
  perStep: -0.002,
  tightest: -0.05,
  loosest: 0,
  overrides: {},
}

export const letterSpacingScale = buildLetterSpacingScale(letterSpacingRule, typeSteps)

/** Line height as a ratio of the font size, one rule per kind of text. */
export const lineHeightRules = {
  heading: { base: 1, perStep: 0, tightest: 1, loosest: 1, overrides: {} },
  copy: { base: 1.19, perStep: -0.05, tightest: 1, loosest: 1.19, overrides: {} },
} as const satisfies Record<string, StepRule>

const lineHeightScales = buildLineHeightScales(lineHeightRules, typeSteps)
const lineHeightIs = (kind: keyof typeof lineHeightRules): StepValues =>
  lineHeightPercentByStep(lineHeightScales[kind])

const letterSpacingIsScale = { variable: 'Letter spacing/Step {step}' } as const
const paragraphSpacingIsFontSize = { variable: 'Font size/Step {step}', maxStep: 10 } as const

export const typographyRoles = {
  default: {
    figmaGroup: 'Default',
    purpose: 'Body and interface text',
    family: 'Body',
    weight: 'Regular',
    steps: stepsFrom(-4, 14),
    lineHeight: lineHeightIs('copy'),
    letterSpacing: letterSpacingIsScale,
    paragraphSpacing: paragraphSpacingIsFontSize,
  },
  medium: {
    figmaGroup: 'Medium',
    purpose: 'Emphasised body and interface text',
    family: 'Body',
    weight: 'Medium',
    steps: stepsFrom(-4, 14),
    lineHeight: lineHeightIs('copy'),
    letterSpacing: letterSpacingIsScale,
    paragraphSpacing: paragraphSpacingIsFontSize,
  },
  strong: {
    figmaGroup: 'Strong',
    purpose: 'Bold body text, in the copy typeface',
    family: 'Body',
    weight: 'Bold',
    steps: stepsFrom(-4, 10),
    lineHeight: lineHeightIs('copy'),
    letterSpacing: letterSpacingIsScale,
    paragraphSpacing: { variable: 'Font size/Step {step}' },
  },
  prose: {
    figmaGroup: 'Prose',
    purpose: 'Long-form reading text',
    family: 'Body',
    weight: 'Regular',
    steps: stepsFrom(-4, 10),
    lineHeight: lineHeightIs('copy'),
    letterSpacing: letterSpacingIsScale,
    paragraphSpacing: { variable: 'Font size/Step {step}' },
  },
  code: {
    figmaGroup: 'Code',
    purpose: 'Code and other monospaced text',
    family: 'Mono',
    weight: 'Regular',
    steps: stepsFrom(-4, 14),
    lineHeight: lineHeightIs('copy'),
    letterSpacing: 0,
    paragraphSpacing: paragraphSpacingIsFontSize,
  },
  heading: {
    figmaGroup: 'Heading',
    purpose: 'Headings and titles',
    family: 'Heading',
    weight: 'Regular',
    steps: stepsFrom(0, 10),
    lineHeight: lineHeightIs('heading'),
    letterSpacing: letterSpacingIsScale,
    paragraphSpacing: 0,
    elements: { 6: 'h1', 5: 'h2', 4: 'h3', 3: 'h4', 2: 'h5', 1: 'h6' },
  },
} as const satisfies Record<string, TypographyRole<FontFamilyKey, FontWeightKey>>

export default defineTypography({
  figma: typographyFigma,
  fonts: typographyFonts,
  letterSpacingScale,
  lineHeightRules,
  roles: typographyRoles,
})
`
}

export function figmaVariablesConfig(): string {
  return `/**
 * Which Figma variables the plugin writes from code, and where they live: the Utopia primitives,
 * the letter spacing primitives and the \`Fluid tokens\` groups that alias them in Min and Max
 * modes. Figma owns everything that points at them. The names match the S58 starter Figma file.
 */
import { defineFigmaVariables } from '@signal58/design-tokens'

export default defineFigmaVariables({
  type: { collection: 'Type primitives', minGroup: 'Font size @min', maxGroup: 'Font size @max' },
  letterSpacing: {
    collection: 'Type primitives',
    minGroup: 'Letter spacing @min',
    maxGroup: 'Letter spacing @max',
  },
  space: {
    collection: 'Space primitives',
    minGroup: 'Space @min',
    maxGroup: 'Space @max',
    fixed: { Zero: 0 },
  },
  fluid: {
    collection: 'Fluid tokens',
    modes: { min: 'Min', max: 'Max' },
    fontSizeGroup: 'Font size',
    letterSpacingGroup: 'Letter spacing',
    spaceGroup: 'Space size',
    pairsGroup: 'Space size pairs',
    customPairsGroup: 'Space size pairs/Custom pairs',
    namedPairs: {},
  },
})
`
}

export function tokensConfig(o: StarterOptions): string {
  const slug = slugOf(o.name)
  const id = o.id ?? `${slug}-tokens-dev`
  const out = (o.out ?? 'src/styles/tokens').replace(/\/$/, '')
  return `/**
 * ${o.name}'s token config: the module configs in this folder, plus what belongs to the project as
 * a whole. The s58-tokens command (@signal58/design-tokens) reads it:
 *
 *   s58-tokens build          # design-tokens/generated, then the files below
 *   s58-tokens check          # read only, for CI
 *   s58-tokens figma plugin   # the Figma plugin, from these configs
 */
import { defineTokens } from '@signal58/design-tokens'

import figmaVariables from ${local('figma-variables.config')}
import palette from ${local('palette.config')}
import typography from ${local('typography.config')}
import utopia from ${local('utopia.config')}

export default defineTokens({
  name: ${quote(o.name)},
  figma: {
    // The project's Figma file, from its URL: figma.com/design/<file key>/…. The plugin and the
    // use_figma scripts refuse to run on any other file, or until this is set.
    fileKey: ${quote(o.fileKey ?? '')},
    plugin: { name: ${quote(`${o.name} Tokens`)}, id: ${quote(id)} },
  },
  palette,
  utopia,
  typography,
  figmaVariables,
  // A Sass helper for one-off fluid values on the same viewport. Needs utopia-core-scss installed:
  //   fluidTool: { output: '${out}/_fluid.scss' },
  // Breakpoints: SCSS variables, a media query map for a breakpoint mixin of the project's own,
  // and CSS custom properties (--bp-min-width-m and so on). S58 Marketing's widths, as a first guess:
  //   breakpoints: {
  //     rootFontSize: 16,
  //     sizes: {
  //       sm: { minWidth: 480, suffix: 's', label: 'Small devices' },
  //       md: { minWidth: 768, suffix: 'm', label: 'Medium devices' },
  //       lg: { minWidth: 1024, suffix: 'l', label: 'Large devices' },
  //       xl: { minWidth: 1400, suffix: 'xl', label: 'Extra large devices' },
  //       xxl: { minWidth: 1550, suffix: 'xxl', label: 'Max-width devices' },
  //     },
  //     layout: { pageMinContentWidth: 320, pageMaxWidth: 1550 },
  //     mapName: 'breakpoints',
  //     output: { scss: '${out}/_breakpoints.scss', css: '${out}/_breakpoints-css.scss' },
  //   },
  build: {
    // Once designers have set up the semantic colours, export them from Figma (one file per mode)
    // and add them here, with a semantic colours file below:
    //   semantics: { colours: { light: 'design-tokens/figma/colors/light.tokens.json', dark: '…' } },
    //   { destination: '${out}/_color-semantic.scss', format: 's58/scss/semantic-colours',
    //     options: { modes: [{ mode: 'light', selector: ':root' }, { mode: 'dark', selector: "[data-theme='dark']" }] } },
    files: [
      { destination: ${quote(`${out}/_color-primitives.scss`)}, format: 's58/scss/colour-primitives' },
      { destination: ${quote(`${out}/_font-size-primitives.scss`)}, format: 's58/scss/font-size-primitives' },
      {
        destination: ${quote(`${out}/_spacing-primitives.scss`)},
        format: 's58/scss/space-primitives',
        options: { staticTokens: [{ label: 'none', value: '0' }] },
      },
      { destination: ${quote(`${out}/_letter-spacing-primitives.scss`)}, format: 's58/scss/letter-spacing-primitives' },
      { destination: ${quote(`${out}/_line-height-primitives.scss`)}, format: 's58/scss/line-height-primitives' },
      { destination: ${quote(`${out}/_line-height-utilities.scss`)}, format: 's58/scss/line-height-utilities' },
    ],
  },
  // The project's formatter, run on each built file, so the build writes what the repository keeps:
  //   format: { command: ['oxfmt', '--stdin-filepath={file}'] },
  check: { allowApcaMisses: [] },
})
`
}

/** Every file init writes, by path from the project root. */
export function starterFiles(o: StarterOptions): Record<string, string> {
  return {
    'design-tokens/palette.config.ts': paletteConfig(o),
    'design-tokens/utopia.config.ts': utopiaConfig(),
    'design-tokens/typography.config.ts': typographyConfig(),
    'design-tokens/figma-variables.config.ts': figmaVariablesConfig(),
    'design-tokens/tokens.config.ts': tokensConfig(o),
    'design-tokens/figma-plugin/.gitignore': 'code.js\n',
  }
}
