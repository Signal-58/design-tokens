/**
 * Figma's variable scopes: which property pickers a variable appears in. Typed, so a misspelt
 * scope is an error in the editor, and checked when a config loads.
 */
/** Every scope Figma accepts on a variable (VariableScope in the Plugin API). */
export declare const VARIABLE_SCOPES: readonly ['ALL_SCOPES', 'TEXT_CONTENT', 'CORNER_RADIUS', 'WIDTH_HEIGHT', 'GAP', 'ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR', 'STROKE_FLOAT', 'EFFECT_FLOAT', 'EFFECT_COLOR', 'OPACITY', 'FONT_FAMILY', 'FONT_STYLE', 'FONT_WEIGHT', 'FONT_SIZE', 'LINE_HEIGHT', 'LETTER_SPACING', 'PARAGRAPH_SPACING', 'PARAGRAPH_INDENT', 'FONT_VARIATIONS'];
export type VariableScope = (typeof VARIABLE_SCOPES)[number];
/** The scopes Figma accepts on a colour variable. */
export declare const COLOUR_SCOPES: readonly ["ALL_SCOPES", "ALL_FILLS", "FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR", "EFFECT_COLOR"];
export type ColourScope = (typeof COLOUR_SCOPES)[number];
/**
 * Checks a colour variable's scopes: only colour scopes, and no `ALL_SCOPES` or `ALL_FILLS`
 * alongside what they already include. `where` names the setting in the error.
 */
export declare function checkColourScopes(where: string, scopes: readonly string[]): void;
