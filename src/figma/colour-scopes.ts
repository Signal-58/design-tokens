/**
 * Colour scopes for variables Figma owns (`colourScopes` in the Figma variables config): the
 * semantic colours designers make and code reads from Figma's export. Code sets only which pickers
 * each one appears in. Values, names and aliases stay Figma's.
 *
 * A rule covers every colour variable under `group` in `collection` (or the one variable whose name
 * is `group`). When rules overlap, the most specific group wins, so one variable can differ from
 * its group.
 */
import { checkKeys, keysOf } from '../keys'
import { figmaScript, type FileGuard } from './inline'
import { checkColourScopes, type ColourScope } from './scopes'

export { COLOUR_SCOPES, type ColourScope } from './scopes'

export interface ColourScopeRule {
  /** The variable collection, such as `Colours`. */
  collection: string
  /** A group (`Typography`), a subgroup (`Typography/links`) or one variable's full name. */
  group: string
  /**
   * The exact scopes, replacing what's in Figma. `SHAPE_FILL` covers vector layers, so imported
   * SVGs. An empty list hides the variables from every picker.
   */
  scopes: readonly ColourScope[]
}

const RULE_KEYS = keysOf<ColourScopeRule>()('collection', 'group', 'scopes')

export interface ColourScopesSpec {
  rules: ColourScopeRule[]
}

/** Checks the rules: known scopes, combinations Figma accepts, and no group given twice. */
export function buildColourScopesSpec(rules: readonly ColourScopeRule[]): ColourScopesSpec {
  const seen = new Set<string>()
  rules.forEach((rule, i) => {
    checkKeys(`colourScopes[${i}]`, rule, RULE_KEYS)
    const where = `colourScopes ${rule.collection} / ${rule.group}`
    if (!rule.collection || !rule.group) throw new Error(`${where}: needs a collection and a group`)
    const id = `${rule.collection}\u0000${rule.group}`
    if (seen.has(id)) throw new Error(`${where} is given twice`)
    seen.add(id)
    checkColourScopes(where, rule.scopes)
  })
  return { rules: rules.map((r) => ({ ...r, scopes: [...r.scopes] })) }
}

/** The use_figma script for the colour scopes module. */
export function buildColourScopesScript(
  spec: ColourScopesSpec,
  dryRun: boolean,
  guard: FileGuard,
): string {
  return figmaScript('apply-colour-scopes.figma.js', 'applyColourScopes', spec, dryRun, guard)
}
