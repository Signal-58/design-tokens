/**
 * The palette generator: turns a palette config (definePalette) into a list of colours, each fitted
 * to the gamut. CSS and Figma (figma/variables.ts) both read this list.
 */
import { fitToGamut } from './colour'
import { generateScale } from './scale'
import type { ColourScale, Oklch, PaletteConfig, ScaleInput, ScaleStep } from './types'

export interface PaletteColour {
  /** The group in Figma and CSS: `amber`, `black_alpha`, `general`. */
  group: string
  /** The name in the group: `6`, `ref`, `a07`, `black_pure`. */
  name: string
  /** The colour after gamut fitting. For an alias, the colour it points at. */
  colour: Oklch
  /** The colour as configured, before fitting. */
  configured: Oklch
  /** For an alias: the group and name it points at. */
  aliasOf?: { group: string; name: string }
}

/** A scale and step number, such as `['charcoal', 15]`. */
type Step = ScaleStep

const isStep = (v: Step | Oklch): v is Step => Array.isArray(v)

export const alphaName = (percent: number): string => `a${String(percent).padStart(2, '0')}`

const isExplicit = (s: ScaleInput): s is ColourScale => typeof s === 'object' && 'lightness' in s

/** Every scale with all its steps: given ones as they are, the rest generated from their reference. */
export function resolveScales(config: Omit<PaletteConfig, 'figma'>): Record<string, ColourScale> {
  return Object.fromEntries(
    Object.entries(config.scales).map(([group, s]) => [
      group,
      isExplicit(s) ? s : generateScale(s, config.rules, config.gamut, group),
    ]),
  )
}

/** Every colour in the palette, in the order CSS and Figma list them. */
export function buildPalette(config: Omit<PaletteConfig, 'figma'>): PaletteColour[] {
  const scaleColours = new Map<string, PaletteColour>()
  const scaleList: PaletteColour[] = []
  const scales = resolveScales(config)

  for (const [group, scale] of Object.entries(scales)) {
    for (const key of ['lightness', 'chroma'] as const) {
      if (scale[key].length !== config.steps) {
        throw new Error(`${group}.${key} has ${scale[key].length} values; it needs ${config.steps}`)
      }
    }
    for (let i = 0; i < config.steps; i++) {
      const configured = { l: scale.lightness[i], c: scale.chroma[i], h: scale.hue }
      const entry = {
        group,
        name: String(i + 1),
        colour: fitToGamut(configured, config.gamut),
        configured,
      }
      scaleColours.set(`${group}/${entry.name}`, entry)
      scaleList.push(entry)
    }
  }

  const stepColour = ([group, step]: Step, from: string): PaletteColour => {
    const target = scaleColours.get(`${group}/${step}`)
    if (!target) throw new Error(`${from} points at ${group} ${step}, which isn't in the palette`)
    return target
  }
  const alias = (group: string, name: string, step: Step): PaletteColour => {
    const target = stepColour(step, `${group}/${name}`)
    return {
      group,
      name,
      colour: target.colour,
      configured: target.configured,
      aliasOf: { group: target.group, name: target.name },
    }
  }
  const own = (group: string, name: string, configured: Oklch): PaletteColour => ({
    group,
    name,
    colour: fitToGamut(configured, config.gamut),
    configured,
  })

  const general = Object.entries(config.general).map(([name, v]) =>
    isStep(v) ? alias('general', name, v) : own('general', name, v),
  )

  const alphas = Object.entries(config.alphas).flatMap(([group, scale]) => [
    ...scale.alphas.map((percent) =>
      own(group, alphaName(percent), { ...scale.colour, alpha: percent / 100 }),
    ),
    ...(scale.ref ? [alias(group, 'ref', scale.ref)] : []),
  ])

  const refs = new Map<string, PaletteColour>()
  for (const [group, scale] of Object.entries(scales)) {
    if (scale.ref === undefined) continue
    refs.set(
      group,
      typeof scale.ref === 'number'
        ? alias(group, 'ref', [group, scale.ref])
        : own(group, 'ref', scale.ref),
    )
  }
  const scalesWithRefs = Object.keys(scales).flatMap((group) => [
    ...(refs.has(group) ? [refs.get(group)!] : []),
    ...scaleList.filter((c) => c.group === group),
  ])

  return [...general, ...alphas, ...scalesWithRefs]
}
