/**
 * The package's Style Dictionary formats. Each reads the whole dictionary and picks its tokens by
 * path, so a project lists files, not filters. Every format gets the project's token config as
 * `options.tokens` (buildTokenFiles adds it).
 */
import type { Dictionary, TransformedToken } from 'style-dictionary/types'

import type { TokensConfig } from '../config'
import {
  CODE_SYNTAX_EXTENSION,
  FLUID_EXTENSION,
  type FluidExtension,
  type FluidKind,
} from '../dtcg/generate'
import { GENERATED_HEADER } from '../responsive/breakpoints'
import { semanticsScss } from '../semantics/format'

export interface FormatArgs {
  dictionary: Dictionary
  options: Record<string, unknown> & { tokens: TokensConfig }
}

const pathOf = (t: TransformedToken) => t.path.join('.')
const startsWith = (t: TransformedToken, prefix: readonly string[]) =>
  prefix.every((part, i) => t.path[i] === part)

/** The token's CSS name without `--`: its code syntax, when it has one. */
export function cssNameOf(t: TransformedToken): string | undefined {
  const web = (t.$extensions?.[CODE_SYNTAX_EXTENSION] as { WEB?: string } | undefined)?.WEB
  return web
}

export function fluidOf(t: TransformedToken): FluidExtension | undefined {
  return t.$extensions?.[FLUID_EXTENSION] as FluidExtension | undefined
}

/** Every token, including any a file filter dropped, by path (`fluid.Space size.S`). */
export function tokensByPath(dictionary: Dictionary): Map<string, TransformedToken> {
  return new Map(
    (dictionary.unfilteredAllTokens ?? dictionary.allTokens).map((t) => [pathOf(t), t]),
  )
}

const referencePath = (value: unknown) =>
  typeof value === 'string' && /^\{.+\}$/.test(value) ? value.slice(1, -1) : undefined

/** Follows references from a token until one has a CSS name (or the chain ends). */
export function referencedCssToken(
  token: TransformedToken,
  byPath: Map<string, TransformedToken>,
): TransformedToken | undefined {
  let ref = referencePath(token.original.$value)
  const seen = new Set<string>()
  while (ref) {
    if (seen.has(ref)) throw new Error(`Circular reference at ${pathOf(token)}`)
    seen.add(ref)
    const target = byPath.get(ref)
    if (!target) throw new Error(`${pathOf(token)} references ${ref}, which doesn't exist`)
    if (cssNameOf(target)) return target
    ref = referencePath(target.original.$value)
  }
  return undefined
}

/** The token at the end of a reference chain. */
function rootOf(token: TransformedToken, byPath: Map<string, TransformedToken>): TransformedToken {
  let current = token
  let ref = referencePath(current.original.$value)
  while (ref) {
    const next = byPath.get(ref)
    if (!next) throw new Error(`${pathOf(current)} references ${ref}, which doesn't exist`)
    current = next
    ref = referencePath(current.original.$value)
  }
  return current
}

// ─── Colours ───────────────────────────────────────────────────────────────

function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

/** The sRGB hex of an `oklch()` string, clipped per channel: the comment and fallback in the CSS. */
export function oklchToHex(oklch: string): string {
  const m = oklch.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+%?))?\s*\)/)
  if (!m) return '#000000'
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const L = clamp(m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]), 0, 1)
  const C = parseFloat(m[2])
  const H = parseFloat(m[3])
  const alpha =
    m[4] !== undefined ? (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])) : 1
  const a_ = C * Math.cos((H * Math.PI) / 180)
  const b_ = C * Math.sin((H * Math.PI) / 180)
  const l3 = (L + 0.3963377774 * a_ + 0.2158037573 * b_) ** 3
  const m3 = (L - 0.1055613458 * a_ - 0.0638541728 * b_) ** 3
  const s3 = (L - 0.0894841775 * a_ - 1.291485548 * b_) ** 3
  const channels = [
    +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ].map((c) => Math.round(clamp(linearToSrgb(c), 0, 1) * 255))
  if (alpha < 0.999) channels.push(Math.round(clamp(alpha, 0, 1) * 255))
  return `#${channels.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`
}

/**
 * `:root` with every colour primitive under `options.path` (default `primitive.colors`), grouped
 * by scale in palette order, steps in number order, then named ones. Aliases print the colour they
 * point at. Each line has the sRGB hex as a comment.
 */
export function colourPrimitivesScss({ dictionary, options }: FormatArgs): string {
  const prefix = String(options.path ?? 'primitive.colors').split('.')
  const groups = new Map<string, TransformedToken[]>()
  for (const t of dictionary.allTokens) {
    if (!startsWith(t, prefix) || t.path.length !== prefix.length + 2) continue
    const group = t.path[prefix.length]
    groups.set(group, [...(groups.get(group) ?? []), t])
  }
  const lines = [GENERATED_HEADER, '', ':root {']
  const step = (t: TransformedToken) => t.path[t.path.length - 1].replace(/_/g, '-')
  for (const [group, tokens] of groups) {
    lines.push(`  // ${group.replace(/_/g, '-')}`)
    const sorted = [...tokens].sort((a, b) => {
      const [x, y] = [parseInt(step(a), 10), parseInt(step(b), 10)]
      if (!isNaN(x) && !isNaN(y)) return x - y
      if (!isNaN(x)) return -1
      if (!isNaN(y)) return 1
      return step(a).localeCompare(step(b))
    })
    for (const t of sorted) {
      const value = String(t.$value)
      lines.push(`  --${cssNameOf(t)}: ${value}; /* ${oklchToHex(value)} */`)
    }
    lines.push('')
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

export interface SemanticColourEntry {
  cssName: string
  value: string
  /** The top-level Figma group: `Surface`. */
  group: string
  /** Nested groups below it, joined with `.`: `Mono`. */
  subgroup?: string
}

/**
 * One mode's semantic colours (`color.<mode>`), in the export's order. A reference to a primitive
 * is `var(--primitive, #hex)`; to another semantic, `var(--semantic)`. Only tokens with code syntax
 * reach code.
 */
export function semanticColourEntries(
  dictionary: Dictionary,
  mode: string,
  root = 'color',
): SemanticColourEntry[] {
  const byPath = tokensByPath(dictionary)
  const entries: SemanticColourEntry[] = []
  for (const t of dictionary.allTokens) {
    if (t.path[0] !== root || t.path[1] !== mode) continue
    const name = cssNameOf(t)
    if (!name) continue
    const [group, ...rest] = t.path.slice(2, -1)
    let value: string
    const target = referencedCssToken(t, byPath)
    if (target) {
      const targetName = cssNameOf(target)
      value =
        target.path[0] === 'primitive'
          ? `var(--${targetName}, ${oklchToHex(String(target.$value))})`
          : `var(--${targetName})`
    } else {
      const raw = t.original.$value as { hex?: string; alpha?: number; components?: number[] }
      if (typeof raw === 'object' && raw !== null && raw.alpha !== undefined && raw.alpha < 0.999) {
        const [r, g, b] = (raw.components ?? [0, 0, 0]).map((c) => Math.round(c * 255))
        value = `rgba(${r}, ${g}, ${b}, ${Math.round(raw.alpha * 100) / 100})`
      } else if (typeof raw === 'object' && raw?.hex) {
        value = raw.hex.toUpperCase()
      } else {
        value = typeof raw === 'string' ? raw : 'transparent'
      }
    }
    entries.push({
      cssName: `--${name}`,
      value,
      group,
      subgroup: rest.length ? rest.join('.') : undefined,
    })
  }
  return entries
}

interface ModeBlock {
  mode: string
  selector: string
  /** Lines written at the top of the block, such as `color-scheme: light;`. */
  lines?: string[]
}

/**
 * A block per mode of semantic colours. `options.groups` orders the groups and labels them
 * (`{ path: 'Surface.Mono', label: 'Surface — Mono' }`); groups not listed come last.
 */
export function semanticColoursScss({ dictionary, options }: FormatArgs): string {
  const modes = options.modes as ModeBlock[]
  const groups = (options.groups ?? []) as { path: string; label?: string }[]
  const order = groups.map((g) => g.path)
  const label = (key: string) => groups.find((g) => g.path === key)?.label ?? key
  const lines = [GENERATED_HEADER, '']
  for (const block of modes) {
    lines.push(`${block.selector} {`, ...(block.lines ?? []).map((l) => `  ${l}`))
    const key = (e: SemanticColourEntry) => (e.subgroup ? `${e.group}.${e.subgroup}` : e.group)
    const rank = (e: SemanticColourEntry) => {
      const i = order.indexOf(key(e))
      return i === -1 ? order.length : i
    }
    const sorted = semanticColourEntries(dictionary, block.mode)
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => rank(a.entry) - rank(b.entry) || a.index - b.index)
      .map(({ entry }) => entry)
    let current = ''
    for (const entry of sorted) {
      if (key(entry) !== current) {
        if (current) lines.push('')
        lines.push(`  // ${label(key(entry))}`)
        current = key(entry)
      }
      lines.push(`  ${entry.cssName}: ${entry.value};`)
    }
    lines.push('}', '')
  }
  return lines.join('\n')
}

// ─── Fluid type and space ──────────────────────────────────────────────────

export interface FluidEntry {
  token: TransformedToken
  cssName: string
  kind: FluidKind
  label: string
  min: number
  max: number
  clamp?: string
}

/** The generated fluid primitives of the given kinds, in order (type steps smallest first). */
export function fluidEntries(
  dictionary: Dictionary,
  kinds: readonly FluidKind[],
  root = ['fluid'],
): FluidEntry[] {
  const entries = dictionary.allTokens.flatMap((t) => {
    const fluid = fluidOf(t)
    const name = cssNameOf(t)
    if (!fluid || !name || !startsWith(t, root) || !kinds.includes(fluid.kind)) return []
    return [{ token: t, cssName: `--${name}`, ...fluid }]
  })
  return entries
}

const byStep = (a: FluidEntry, b: FluidEntry) => Number(a.label) - Number(b.label)

/** The type steps' font sizes: `fluid.<fontSizeGroup>`. */
export function fontSizeEntries(dictionary: Dictionary, config: TokensConfig): FluidEntry[] {
  const group = config.figmaVariables.fluid.fontSizeGroup.split('/')
  return fluidEntries(dictionary, ['type'], ['fluid', ...group]).sort(byStep)
}

/** A link to the Utopia calculator with the project's settings. */
export function utopiaLink(config: TokensConfig, kind: 'type' | 'space'): string {
  const { type, space } = config.utopia
  const negative = space.negativeSteps?.join('|') ?? ''
  const positive = space.positiveSteps?.join('|') ?? ''
  const custom = space.customSizes?.join('|') ?? ''
  return `https://utopia.fyi/${kind}/calculator?c=${type.minWidth},${type.minFontSize},${type.minTypeScale},${type.maxWidth},${type.maxFontSize},${type.maxTypeScale},${type.positiveSteps},${type.negativeSteps},&s=${negative},${positive},${custom}&g=xs,m,3xl,12`
}

export function fontSizePrimitivesScss({ dictionary, options }: FormatArgs): string {
  const lines = [GENERATED_HEADER, `/* @link ${utopiaLink(options.tokens, 'type')} */`, ':root {']
  for (const e of fontSizeEntries(dictionary, options.tokens)) {
    lines.push(`  ${e.cssName}: ${e.clamp};`)
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

/** A space value that isn't fluid, written as it is: `auto`, `0`, `56.25%`. */
export interface StaticSpaceToken {
  label: string
  value: string
  comment?: string
}

/**
 * `:root` with the space sizes, the one-up pairs and the custom pairs, then `options.staticTokens`
 * (fixed values written as given).
 */
export function spacePrimitivesScss({ dictionary, options }: FormatArgs): string {
  const statics = (options.staticTokens ?? []) as StaticSpaceToken[]
  const line = (e: FluidEntry) => `  ${e.cssName}: ${e.clamp};`
  const lines = [GENERATED_HEADER, `/* @link ${utopiaLink(options.tokens, 'space')} */`, ':root {']
  lines.push(...fluidEntries(dictionary, ['size']).map(line))
  lines.push('', '  /* One-up pairs */', ...fluidEntries(dictionary, ['one-up-pair']).map(line))
  lines.push('', '  /* Custom pairs */', ...fluidEntries(dictionary, ['custom-pair']).map(line))
  lines.push('')
  for (const t of statics) {
    lines.push(
      `  --space-${t.label}: ${t.comment ? `${t.value}; /* ${t.comment} */` : `${t.value};`}`,
    )
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

export function letterSpacingPrimitivesScss({ dictionary, options }: FormatArgs): string {
  const group = options.tokens.figmaVariables.fluid.letterSpacingGroup.split('/')
  const lines = [GENERATED_HEADER, ':root {']
  for (const e of fluidEntries(dictionary, ['type'], ['fluid', ...group]).sort(byStep)) {
    lines.push(`  ${e.cssName}: ${e.min}em;`)
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

/** Line height entries by kind of text, each smallest step first. */
export function lineHeightEntries(dictionary: Dictionary): Map<string, FluidEntry[]> {
  const kinds = new Map<string, FluidEntry[]>()
  for (const e of fluidEntries(dictionary, ['type'], ['line-height'])) {
    const kind = e.token.path[1]
    kinds.set(kind, [...(kinds.get(kind) ?? []), e])
  }
  for (const entries of kinds.values()) entries.sort(byStep)
  return kinds
}

export function lineHeightPrimitivesScss({ dictionary }: FormatArgs): string {
  const lines = [GENERATED_HEADER, ':root {']
  for (const entries of lineHeightEntries(dictionary).values()) {
    for (const e of entries) lines.push(`  ${e.cssName}: ${e.min};`)
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

/** `.u-line-height-<kind>-<step>` classes, one per line height primitive. */
export function lineHeightUtilitiesScss({ dictionary }: FormatArgs): string {
  const lines = [GENERATED_HEADER]
  for (const entries of lineHeightEntries(dictionary).values()) {
    for (const e of entries) {
      const name = e.cssName.slice(2)
      lines.push(`.u-${name} {`, `  line-height: var(${e.cssName});`, '}')
    }
  }
  return `${lines.join('\n')}\n`
}

/**
 * The semantic fluid tokens (`fluid.<group>` for each of `options.groups`) whose reference chain
 * ends in `options.family`: `font-size` (the font size primitives) or `space` (space sizes and
 * pairs). Only tokens with code syntax reach code; each is a `var()` of what it references.
 */
export function fluidSemanticsScss({ dictionary, options }: FormatArgs): string {
  const f = options.tokens.figmaVariables.fluid
  const groups = options.groups as string[]
  const family = options.family as 'font-size' | 'space'
  const roots =
    family === 'font-size' ? [f.fontSizeGroup] : [f.spaceGroup, f.pairsGroup, f.customPairsGroup]
  const inFamily = (t: TransformedToken) =>
    roots.some((g) => startsWith(t, ['fluid', ...g.split('/')]))
  const byPath = tokensByPath(dictionary)
  const lines = [GENERATED_HEADER, ':root {']
  let current = ''
  for (const t of dictionary.allTokens) {
    if (t.path[0] !== 'fluid' || !groups.includes(t.path[1])) continue
    const name = cssNameOf(t)
    const target = referencedCssToken(t, byPath)
    if (!name || !target || !inFamily(rootOf(t, byPath))) continue
    if (t.path[1] !== current) {
      if (current) lines.push('')
      lines.push(`  /* ${t.path[1]} */`)
      current = t.path[1]
    }
    lines.push(`  --${name}: var(--${cssNameOf(target)});`)
  }
  lines.push('}')
  return `${lines.join('\n')}\n`
}

/** The package's formats, by the name a project's `build.files` uses. */
/**
 * `s58/scss/layout`: the layout config's sizes that go into CSS, in px as configured, a comment
 * per group: `--hero-size-small: 550px`.
 */
export function layoutScss({ dictionary }: FormatArgs): string {
  const lines: string[] = []
  let heading = ''
  for (const t of dictionary.allTokens) {
    if (t.path[0] !== 'layout') continue
    const name = cssNameOf(t)
    if (!name) continue
    const group = t.path.slice(1, -1).join('/')
    if (group !== heading) {
      if (lines.length) lines.push('')
      lines.push(`  /* ${group} */`)
      heading = group
    }
    const { value, unit } = t.original.$value as { value: number; unit: string }
    lines.push(`  --${name}: ${value === 0 ? '0' : `${value}${unit}`};`)
  }
  return `${GENERATED_HEADER}\n\n:root {\n${lines.join('\n')}\n}\n`
}

export const packageFormats = {
  's58/scss/colour-primitives': colourPrimitivesScss,
  's58/scss/semantic-colours': semanticColoursScss,
  's58/scss/font-size-primitives': fontSizePrimitivesScss,
  's58/scss/space-primitives': spacePrimitivesScss,
  's58/scss/letter-spacing-primitives': letterSpacingPrimitivesScss,
  's58/scss/line-height-primitives': lineHeightPrimitivesScss,
  's58/scss/line-height-utilities': lineHeightUtilitiesScss,
  's58/scss/fluid-semantics': fluidSemanticsScss,
  's58/scss/semantics': semanticsScss,
  's58/scss/layout': layoutScss,
} as const
