/**
 * The package's Style Dictionary formats. Each reads the whole dictionary and picks its tokens by
 * path, so a project lists files, not filters. Every format gets the project's token config as
 * `options.tokens` (buildTokenFiles adds it).
 */
import type { Dictionary, TransformedToken } from 'style-dictionary/types';
import type { TokensConfig } from '../config.js';
import { type FluidExtension, type FluidKind } from '../dtcg/generate.js';
import { semanticsScss } from '../semantics/format.js';
export interface FormatArgs {
    dictionary: Dictionary;
    options: Record<string, unknown> & {
        tokens: TokensConfig;
    };
}
/** The token's CSS name without `--`: its code syntax, when it has one. */
export declare function cssNameOf(t: TransformedToken): string | undefined;
export declare function fluidOf(t: TransformedToken): FluidExtension | undefined;
/** Every token, including any a file filter dropped, by path (`fluid.Space size.S`). */
export declare function tokensByPath(dictionary: Dictionary): Map<string, TransformedToken>;
/** Follows references from a token until one has a CSS name (or the chain ends). */
export declare function referencedCssToken(token: TransformedToken, byPath: Map<string, TransformedToken>): TransformedToken | undefined;
/** The sRGB hex of an `oklch()` string, clipped per channel: the comment and fallback in the CSS. */
export declare function oklchToHex(oklch: string): string;
/**
 * `:root` with every colour primitive under `options.path` (default `primitive.colors`), grouped
 * by scale in palette order, steps in number order, then named ones. Aliases print the colour they
 * point at. Each line has the sRGB hex as a comment.
 */
export declare function colourPrimitivesScss({ dictionary, options }: FormatArgs): string;
export interface SemanticColourEntry {
    cssName: string;
    value: string;
    /** The top-level Figma group: `Surface`. */
    group: string;
    /** Nested groups below it, joined with `.`: `Mono`. */
    subgroup?: string;
}
/**
 * One mode's semantic colours (`color.<mode>`), in the export's order. A reference to a primitive
 * is `var(--primitive, #hex)`; to another semantic, `var(--semantic)`. Only tokens with code syntax
 * reach code.
 */
export declare function semanticColourEntries(dictionary: Dictionary, mode: string, root?: string): SemanticColourEntry[];
/**
 * A block per mode of semantic colours. `options.groups` orders the groups and labels them
 * (`{ path: 'Surface.Mono', label: 'Surface — Mono' }`); groups not listed come last.
 */
export declare function semanticColoursScss({ dictionary, options }: FormatArgs): string;
export interface FluidEntry {
    token: TransformedToken;
    cssName: string;
    kind: FluidKind;
    label: string;
    min: number;
    max: number;
    clamp?: string;
}
/** The generated fluid primitives of the given kinds, in order (type steps smallest first). */
export declare function fluidEntries(dictionary: Dictionary, kinds: readonly FluidKind[], root?: string[]): FluidEntry[];
/** The type steps' font sizes: `fluid.<fontSizeGroup>`. */
export declare function fontSizeEntries(dictionary: Dictionary, config: TokensConfig): FluidEntry[];
/** A link to the Utopia calculator with the project's settings. */
export declare function utopiaLink(config: TokensConfig, kind: 'type' | 'space'): string;
export declare function fontSizePrimitivesScss({ dictionary, options }: FormatArgs): string;
/** A space value that isn't fluid, written as it is: `auto`, `0`, `56.25%`. */
export interface StaticSpaceToken {
    label: string;
    value: string;
    comment?: string;
}
/**
 * `:root` with the space sizes, the one-up pairs and the custom pairs, then `options.staticTokens`
 * (fixed values written as given).
 */
export declare function spacePrimitivesScss({ dictionary, options }: FormatArgs): string;
export declare function letterSpacingPrimitivesScss({ dictionary, options }: FormatArgs): string;
/** Line height entries by kind of text, each smallest step first. */
export declare function lineHeightEntries(dictionary: Dictionary): Map<string, FluidEntry[]>;
export declare function lineHeightPrimitivesScss({ dictionary }: FormatArgs): string;
/** `.u-line-height-<kind>-<step>` classes, one per line height primitive. */
export declare function lineHeightUtilitiesScss({ dictionary }: FormatArgs): string;
/**
 * The semantic fluid tokens (`fluid.<group>` for each of `options.groups`) whose reference chain
 * ends in `options.family`: `font-size` (the font size primitives) or `space` (space sizes and
 * pairs). Only tokens with code syntax reach code; each is a `var()` of what it references.
 */
export declare function fluidSemanticsScss({ dictionary, options }: FormatArgs): string;
/** The package's formats, by the name a project's `build.files` uses. */
/**
 * `s58/scss/layout`: the layout config's sizes that go into CSS, in px as configured, a comment
 * per group: `--hero-size-small: 550px`.
 */
export declare function layoutScss({ dictionary }: FormatArgs): string;
export declare const packageFormats: {
    readonly 's58/scss/colour-primitives': typeof colourPrimitivesScss;
    readonly 's58/scss/semantic-colours': typeof semanticColoursScss;
    readonly 's58/scss/font-size-primitives': typeof fontSizePrimitivesScss;
    readonly 's58/scss/space-primitives': typeof spacePrimitivesScss;
    readonly 's58/scss/letter-spacing-primitives': typeof letterSpacingPrimitivesScss;
    readonly 's58/scss/line-height-primitives': typeof lineHeightPrimitivesScss;
    readonly 's58/scss/line-height-utilities': typeof lineHeightUtilitiesScss;
    readonly 's58/scss/fluid-semantics': typeof fluidSemanticsScss;
    readonly 's58/scss/semantics': typeof semanticsScss;
    readonly 's58/scss/layout': typeof layoutScss;
};
