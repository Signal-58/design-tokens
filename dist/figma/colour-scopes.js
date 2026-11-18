/**
 * Colour scopes for variables Figma owns (`colourScopes` in the Figma variables config): the
 * semantic colours designers make and code reads from Figma's export. Code sets only which pickers
 * each one appears in. Values, names and aliases stay Figma's.
 *
 * A rule covers every colour variable under `group` in `collection` (or the one variable whose name
 * is `group`). When rules overlap, the most specific group wins, so one variable can differ from
 * its group.
 */
import { figmaScript } from './inline.js';
/** The scopes Figma accepts on a colour variable. */
export const COLOUR_SCOPES = [
    'ALL_SCOPES',
    'ALL_FILLS',
    'FRAME_FILL',
    'SHAPE_FILL',
    'TEXT_FILL',
    'STROKE_COLOR',
    'EFFECT_COLOR',
];
/** Checks the rules: known scopes, combinations Figma accepts, and no group given twice. */
export function buildColourScopesSpec(rules) {
    const seen = new Set();
    for (const rule of rules) {
        const where = `colourScopes ${rule.collection} / ${rule.group}`;
        if (!rule.collection || !rule.group)
            throw new Error(`${where}: needs a collection and a group`);
        const id = `${rule.collection}\u0000${rule.group}`;
        if (seen.has(id))
            throw new Error(`${where} is given twice`);
        seen.add(id);
        const unknown = rule.scopes.filter((s) => !COLOUR_SCOPES.includes(s));
        if (unknown.length) {
            throw new Error(`${where}: ${unknown.join(', ')} isn't a colour scope (${COLOUR_SCOPES.join(', ')})`);
        }
        if (rule.scopes.includes('ALL_SCOPES') && rule.scopes.length > 1) {
            throw new Error(`${where}: ALL_SCOPES already includes every other scope`);
        }
        const fills = rule.scopes.filter((s) => s === 'FRAME_FILL' || s === 'SHAPE_FILL' || s === 'TEXT_FILL');
        if (rule.scopes.includes('ALL_FILLS') && fills.length) {
            throw new Error(`${where}: ALL_FILLS already includes ${fills.join(', ')}`);
        }
    }
    return { rules: rules.map((r) => ({ ...r, scopes: [...r.scopes] })) };
}
/** The use_figma script for the colour scopes module. */
export function buildColourScopesScript(spec, dryRun, guard) {
    return figmaScript('apply-colour-scopes.figma.js', 'applyColourScopes', spec, dryRun, guard);
}
