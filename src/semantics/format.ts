/**
 * `s58/scss/semantics`: every semantic under `semantic` (src/semantics/tree.ts) that has code
 * syntax, as CSS custom properties, collection by collection.
 *
 * - A collection whose modes are the fluid Min and Max goes in `:root`. Where both modes resolve
 *   to the same named token, the value is its `var()`; otherwise both resolve to px, and the value
 *   is a `clamp()` across the Utopia viewport (or one size, when they're equal).
 * - A collection with one mode goes in `:root`.
 * - Any other collection gets one block per mode, with the selector from `build.semantics.modes`;
 *   the default mode's is `:root` unless the config says otherwise.
 *
 * Sizes are written in rem, except tokens scoped only to line height, opacity or font weight,
 * which stay unitless numbers.
 */
import type { Dictionary, TransformedToken } from 'style-dictionary/types'
import { calculateClamp } from 'utopia-core'

import type { TokensConfig } from '../config'
import { CODE_SYNTAX_EXTENSION } from '../dtcg/generate'
import { FLUID_EXTENSION, type FluidExtension } from '../dtcg/generate'
import { GENERATED_HEADER } from '../responsive/breakpoints'
import { isPulled } from './rules'
import {
  COLLECTION_EXTENSION,
  MODES_EXTENSION,
  SCOPES_EXTENSION,
  UNRESOLVED_EXTENSION,
} from './tree'

type Resolved =
  | { kind: 'var'; name: string }
  | { kind: 'size'; px: number }
  | { kind: 'fluid'; min: number; max: number }

const UNITLESS = new Set(['LINE_HEIGHT', 'OPACITY', 'FONT_WEIGHT'])

const trim = (n: number) => String(Math.round(n * 10000) / 10000)

// Read modes from `original`: Style Dictionary resolves references inside extensions too.
const nameOf = (t: TransformedToken) =>
  (t.$extensions?.[CODE_SYNTAX_EXTENSION] as { WEB?: string } | undefined)?.WEB

const refPath = (value: unknown) =>
  typeof value === 'string' && /^\{.+\}$/.test(value) ? value.slice(1, -1) : undefined

interface CollectionInfo {
  modes: string[]
  defaultMode: string
}

export function semanticsScss({
  dictionary,
  options,
}: {
  dictionary: Dictionary
  options: Record<string, unknown> & { tokens: TokensConfig }
}): string {
  const config = options.tokens
  const semantics = config.build?.semantics
  const selectors = (isPulled(semantics) ? semantics.modes : undefined) ?? {}
  const fluidModes = config.figmaVariables.fluid.modes
  const viewport = config.utopia.viewport
  const all = dictionary.unfilteredAllTokens ?? dictionary.allTokens
  const byPath = new Map(all.map((t) => [t.path.join('.'), t]))
  const collectionOf = (t: TransformedToken) =>
    t.path[0] === 'semantic' ? t.path[1] : t.path[0] === 'fluid' ? 'fluid' : undefined
  const infoOf = (t: TransformedToken): CollectionInfo | undefined =>
    t.$extensions?.[COLLECTION_EXTENSION] as CollectionInfo | undefined
  const isFluid = (info: CollectionInfo | undefined) =>
    !!info &&
    info.modes.length === 2 &&
    info.modes.includes(fluidModes.min) &&
    info.modes.includes(fluidModes.max)

  /** What a token's value is in `mode` (a mode of its own collection, or of whatever references it). */
  function resolve(
    token: TransformedToken,
    mode: string | undefined,
    start: boolean,
    seen = new Set<string>(),
  ): Resolved {
    const where = token.path.join('.')
    if (seen.has(where)) throw new Error(`Circular reference at ${where}`)
    seen.add(where)
    const name = nameOf(token)
    if (!start && name) return { kind: 'var', name }
    const unresolved = token.$extensions?.[UNRESOLVED_EXTENSION]
    if (unresolved) {
      throw new Error(
        `${where} references {${String(unresolved)}}, which isn't in the pulled file or the configs, and an included token resolves through it. Fix the alias in Figma, or exclude what uses it.`,
      )
    }
    const fluid = token.$extensions?.[FLUID_EXTENSION] as FluidExtension | undefined
    if (fluid)
      return fluid.min === fluid.max
        ? { kind: 'size', px: fluid.min }
        : { kind: 'fluid', min: fluid.min, max: fluid.max }
    const modes = token.original.$extensions?.[MODES_EXTENSION] as
      | Record<string, unknown>
      | undefined
    const info = token.path[0] === 'semantic' ? infoOf(token) : undefined
    let value: unknown = token.original.$value
    if (modes && info) {
      if (mode && mode in modes) value = modes[mode]
      else if (isFluid(info)) {
        // Reached from outside the collection: both viewports at once.
        const min = resolveValue(modes[fluidModes.min], token, fluidModes.min, seen)
        const max = resolveValue(modes[fluidModes.max], token, fluidModes.max, seen)
        return combine(min, max, where)
      } else value = info.defaultMode in modes ? modes[info.defaultMode] : Object.values(modes)[0]
    }
    return resolveValue(value, token, mode, seen)
  }

  function resolveValue(
    value: unknown,
    from: TransformedToken,
    mode: string | undefined,
    seen: Set<string>,
  ): Resolved {
    const ref = refPath(value)
    if (ref) {
      const target = byPath.get(ref)
      if (!target) throw new Error(`${from.path.join('.')} references ${ref}, which doesn't exist`)
      return resolve(target, mode, false, new Set(seen))
    }
    if (typeof value === 'number') return { kind: 'size', px: value }
    throw new Error(
      `${from.path.join('.')} has a value the semantics format can't write: ${JSON.stringify(value)}`,
    )
  }

  function combine(min: Resolved, max: Resolved, where: string): Resolved {
    if (min.kind === 'var' && max.kind === 'var' && min.name === max.name) return min
    const px = (r: Resolved, end: 'min' | 'max') =>
      r.kind === 'size' ? r.px : r.kind === 'fluid' ? r[end] : undefined
    const a = px(min, 'min')
    const b = px(max, 'max')
    if (a === undefined || b === undefined) {
      throw new Error(
        `${where}: its ${fluidModes.min} and ${fluidModes.max} values point at different named tokens (${JSON.stringify(min)}, ${JSON.stringify(max)}), which the semantics format can't combine.`,
      )
    }
    return a === b ? { kind: 'size', px: a } : { kind: 'fluid', min: a, max: b }
  }

  function css(r: Resolved, token: TransformedToken): string {
    const scopes = (token.$extensions?.[SCOPES_EXTENSION] as string[] | undefined) ?? []
    const unitless = scopes.length > 0 && scopes.every((s) => UNITLESS.has(s))
    if (r.kind === 'var') return `var(--${r.name})`
    if (r.kind === 'size') return unitless ? trim(r.px) : r.px === 0 ? '0' : `${trim(r.px / 16)}rem`
    if (unitless)
      throw new Error(`${token.path.join('.')} is unitless but fluid, which CSS can't clamp`)
    return calculateClamp({
      minSize: r.min,
      maxSize: r.max,
      minWidth: viewport.minWidth,
      maxWidth: viewport.maxWidth,
      relativeTo: viewport.relativeTo,
    })
  }

  // Blocks by selector, in order; each holds its lines, under a comment per collection and group.
  const blocks = new Map<string, string[]>()
  const headings = new Map<string, string>()
  const add = (selector: string, heading: string, line: string) => {
    const lines = blocks.get(selector) ?? []
    if (headings.get(selector) !== heading) {
      if (lines.length) lines.push('')
      lines.push(`  /* ${heading} */`)
      headings.set(selector, heading)
    }
    lines.push(line)
    blocks.set(selector, lines)
  }
  blocks.set(':root', [])

  for (const token of dictionary.allTokens) {
    if (token.path[0] !== 'semantic') continue
    const name = nameOf(token)
    if (!name) continue
    const collection = collectionOf(token)!
    const info = infoOf(token)
    const heading = `${collection}: ${token.path[2]}`
    const modes = token.original.$extensions?.[MODES_EXTENSION] as Record<string, unknown>
    if (!info || isFluid(info) || info.modes.length < 2) {
      const value = isFluid(info)
        ? combine(
            resolveValue(modes[fluidModes.min], token, fluidModes.min, new Set()),
            resolveValue(modes[fluidModes.max], token, fluidModes.max, new Set()),
            token.path.join('.'),
          )
        : resolve(token, info?.defaultMode, true)
      add(':root', heading, `  --${name}: ${css(value, token)};`)
      continue
    }
    for (const mode of info.modes) {
      const selector =
        selectors[collection]?.[mode] ?? (mode === info.defaultMode ? ':root' : undefined)
      if (!selector) {
        throw new Error(
          `${collection} has a mode, ${mode}, with no selector. Add it to build.semantics.modes, or exclude the collection.`,
        )
      }
      add(
        selector,
        `${heading}${mode === info.defaultMode ? '' : ` (${mode})`}`,
        `  --${name}: ${css(resolve(token, mode, true), token)};`,
      )
    }
  }

  const out = [GENERATED_HEADER]
  for (const [selector, lines] of blocks) {
    if (!lines.length) continue
    out.push('', `${selector} {`, ...lines, '}')
  }
  return `${out.join('\n')}\n`
}
