/**
 * Prints the palette's contrast against pure white and pure black, per scale and step: WCAG 2
 * ratios, and APCA Lc for text in each colour. Then the APCA floors from paletteRules any scale
 * misses, and the colours the gamut fit changed. Run: s58-tokens palette report
 *
 * WCAG 2: 4.5 is AA body text, 3 large text and UI. APCA: Lc 75 body text, 60 other text, 45 large
 * text.
 */
import { apcaContrast, contrastRatio, deltaE, formatOklch } from './colour'
import { buildPalette, resolveScales, type PaletteColour } from './palette'
import { apcaFailures } from './scale'
import type { PaletteConfig } from './types'

const white = { l: 1, c: 0, h: 0 }
const black = { l: 0, c: 0, h: 0 }

export function paletteReport(
  config: Omit<PaletteConfig, 'figma'>,
  palette: PaletteColour[] = buildPalette(config),
): string {
  const scales = [...new Set(palette.filter((c) => /^\d+$/.test(c.name)).map((c) => c.group))]
  const steps = [...new Set(palette.filter((c) => /^\d+$/.test(c.name)).map((c) => c.name))]
  const pad = (s: string, n: number) => s.padStart(n)
  const table = (title: string, measure: (c: PaletteColour['colour']) => string) => {
    const rows = scales.map((scale) => {
      const cells = steps.map((step) => {
        const c = palette.find((p) => p.group === scale && p.name === step)
        return pad(c ? measure(c.colour) : '-', 5)
      })
      return `${scale.padEnd(9)}${cells.join('')}`
    })
    return [title, `${''.padEnd(9)}${steps.map((s) => pad(s, 5)).join('')}`, ...rows].join('\n')
  }
  const fitted = palette.filter((c) => !c.aliasOf && c.colour.c !== c.configured.c)
  const { checked, failures } = generatedApcaFailures(config)
  return [
    table('WCAG 2 contrast on white (4.5 body text, 3 large text and UI)', (c) =>
      contrastRatio(c, white).toFixed(1),
    ),
    '',
    table('WCAG 2 contrast on black (always 21 ÷ contrast on white)', (c) =>
      contrastRatio(c, black).toFixed(1),
    ),
    '',
    table('APCA Lc, text on black (75 body text, 60 other text, 45 large text)', (c) =>
      Math.abs(apcaContrast(c, black)).toFixed(0),
    ),
    '',
    table('APCA Lc, text on white', (c) => Math.abs(apcaContrast(c, white)).toFixed(0)),
    '',
    checked.length === 0
      ? 'APCA floors: no generated scales to check (scales given step by step and neutral ranges are not held to them)'
      : failures.length
        ? `APCA floors missed in generated scales: ${failures.length}`
        : `APCA floors: met by all ${checked.length} generated scales`,
    ...failures.map((f) => `  ${f}`),
    '',
    `Fitted to ${config.gamut}: ${fitted.length}`,
    ...fitted.map(
      (c) =>
        `  ${c.group}/${c.name}: ${formatOklch(c.configured)} → ${formatOklch(c.colour)} (ΔE ${deltaE(c.configured, c.colour).toFixed(2)})`,
    ),
  ].join('\n')
}

/**
 * The APCA floors generated scales miss. The floors are what the rules guarantee for generated
 * hues; scales given step by step and neutral ranges aren't held to them.
 */
export function generatedApcaFailures(config: Omit<PaletteConfig, 'figma'>): {
  checked: string[]
  failures: string[]
} {
  const scaleDefs = resolveScales(config)
  const checked = Object.entries(config.scales as Record<string, unknown>)
    .filter(
      ([, s]) =>
        typeof s === 'string' ||
        (typeof s === 'object' && s !== null && !('lightness' in s) && !('range' in s)),
    )
    .map(([name]) => name)
  const failures = checked.flatMap((name) => apcaFailures(scaleDefs[name], config.rules, name))
  return { checked, failures }
}
