/**
 * Colour scopes for variables Figma owns (`colourScopes` in the Figma variables config): the
 * semantic colours designers make and code reads from Figma's export. Code sets only which pickers
 * each one appears in. Values, names and aliases stay Figma's.
 *
 * A rule covers every colour variable under `group` in `collection` (or the one variable whose name
 * is `group`). When rules overlap, the most specific group wins, so one variable can differ from
 * its group.
 */
import { type FileGuard } from './inline.js';
/** The scopes Figma accepts on a colour variable. */
export declare const COLOUR_SCOPES: readonly ['ALL_SCOPES', 'ALL_FILLS', 'FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR', 'EFFECT_COLOR'];
export type ColourScope = (typeof COLOUR_SCOPES)[number];
export interface ColourScopeRule {
    /** The variable collection, such as `Colours`. */
    collection: string;
    /** A group (`Typography`), a subgroup (`Typography/links`) or one variable's full name. */
    group: string;
    /**
     * The exact scopes, replacing what's in Figma. `SHAPE_FILL` covers vector layers, so imported
     * SVGs. An empty list hides the variables from every picker.
     */
    scopes: readonly ColourScope[];
}
export interface ColourScopesSpec {
    rules: ColourScopeRule[];
}
/** Checks the rules: known scopes, combinations Figma accepts, and no group given twice. */
export declare function buildColourScopesSpec(rules: readonly ColourScopeRule[]): ColourScopesSpec;
/** The use_figma script for the colour scopes module. */
export declare function buildColourScopesScript(spec: ColourScopesSpec, dryRun: boolean, guard: FileGuard): string;
