/**
 * Colour scopes for variables Figma owns (`colourScopes` in the Figma variables config): the
 * semantic colours designers make and code reads from Figma's export. Code sets only which pickers
 * each one appears in. Values, names and aliases stay Figma's.
 *
 * A rule covers every colour variable under `group` in `collection` (or the one variable whose name
 * is `group`). When rules overlap, the most specific group wins, so one variable can differ from
 * its group.
 */
import { checkKeys, keysOf } from '../keys.js';
import { figmaScript } from './inline.js';
import { checkColourScopes } from './scopes.js';
export { COLOUR_SCOPES } from './scopes.js';
const RULE_KEYS = keysOf()('collection', 'group', 'scopes');
/** Checks the rules: known scopes, combinations Figma accepts, and no group given twice. */
export function buildColourScopesSpec(rules) {
    const seen = new Set();
    rules.forEach((rule, i) => {
        checkKeys(`colourScopes[${i}]`, rule, RULE_KEYS);
        const where = `colourScopes ${rule.collection} / ${rule.group}`;
        if (!rule.collection || !rule.group)
            throw new Error(`${where}: needs a collection and a group`);
        const id = `${rule.collection}\u0000${rule.group}`;
        if (seen.has(id))
            throw new Error(`${where} is given twice`);
        seen.add(id);
        checkColourScopes(where, rule.scopes);
    });
    return { rules: rules.map((r) => ({ ...r, scopes: [...r.scopes] })) };
}
/** The use_figma script for the colour scopes module. */
export function buildColourScopesScript(spec, dryRun, guard) {
    return figmaScript('apply-colour-scopes.figma.js', 'applyColourScopes', spec, dryRun, guard);
}
