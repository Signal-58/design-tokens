import { type FileGuard } from './inline.js';
import { type ColourScope } from './scopes.js';
export { COLOUR_SCOPES, type ColourScope } from './scopes.js';
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
