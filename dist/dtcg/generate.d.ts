import type { TokensConfig } from '../config.js';
/** A DTCG group or token. */
export interface DtcgTree {
    [key: string]: DtcgTree | string | number | boolean | unknown[] | undefined;
}
/** `$extensions` key for the fluid data: min and max in px, the viewport, the CSS `clamp()`. */
export declare const FLUID_EXTENSION = "com.signal58.fluid";
/** `$extensions` key Figma uses for code syntax; WEB is the CSS name without `--`. */
export declare const CODE_SYNTAX_EXTENSION = "com.figma.codeSyntax";
/** The CSS prefix of the private colour primitives: `--_primitive-color-amber-6`. */
export declare const COLOUR_PRIMITIVE_PREFIX = "_primitive-color-";
export type FluidKind = 'type' | 'size' | 'fixed' | 'one-up-pair' | 'custom-pair' | 'named-pair';
export interface FluidExtension {
    kind: FluidKind;
    /** The Utopia step (type) or label (space): `0`, `-2`, `s`, `xs-s`. */
    label: string;
    min: number;
    max: number;
    clamp?: string;
}
export declare function paletteTokens(config: TokensConfig): DtcgTree;
export declare function fluidTokens(config: TokensConfig): DtcgTree;
/** The layout config's sizes that go into CSS, or undefined when none do. */
export declare function layoutTokens(config: TokensConfig): DtcgTree | undefined;
/** Every generated DTCG file, by file name. */
export declare function generateDtcg(config: TokensConfig): Record<string, DtcgTree>;
