/**
 * Figma's variable scopes: which property pickers a variable appears in. Typed, so a misspelt
 * scope is an error in the editor, and checked when a config loads.
 */
/** Every scope Figma accepts on a variable (VariableScope in the Plugin API). */
export const VARIABLE_SCOPES = [
    'ALL_SCOPES',
    'TEXT_CONTENT',
    'CORNER_RADIUS',
    'WIDTH_HEIGHT',
    'GAP',
    'ALL_FILLS',
    'FRAME_FILL',
    'SHAPE_FILL',
    'TEXT_FILL',
    'STROKE_COLOR',
    'STROKE_FLOAT',
    'EFFECT_FLOAT',
    'EFFECT_COLOR',
    'OPACITY',
    'FONT_FAMILY',
    'FONT_STYLE',
    'FONT_WEIGHT',
    'FONT_SIZE',
    'LINE_HEIGHT',
    'LETTER_SPACING',
    'PARAGRAPH_SPACING',
    'PARAGRAPH_INDENT',
    'FONT_VARIATIONS',
];
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
/**
 * Checks a colour variable's scopes: only colour scopes, and no `ALL_SCOPES` or `ALL_FILLS`
 * alongside what they already include. `where` names the setting in the error.
 */
export function checkColourScopes(where, scopes) {
    if (!Array.isArray(scopes))
        throw new Error(`${where}: scopes must be a list`);
    const unknown = scopes.filter((s) => !COLOUR_SCOPES.includes(s));
    if (unknown.length) {
        throw new Error(`${where}: ${unknown.join(', ')} isn't a colour scope (${COLOUR_SCOPES.join(', ')})`);
    }
    if (scopes.includes('ALL_SCOPES') && scopes.length > 1) {
        throw new Error(`${where}: ALL_SCOPES already includes every other scope`);
    }
    const fills = scopes.filter((s) => s === 'FRAME_FILL' || s === 'SHAPE_FILL' || s === 'TEXT_FILL');
    if (scopes.includes('ALL_FILLS') && fills.length) {
        throw new Error(`${where}: ALL_FILLS already includes ${fills.join(', ')}`);
    }
}
