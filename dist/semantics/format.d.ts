/**
 * `s58/scss/semantics`: every semantic under `semantic` (src/semantics/tree.ts) that has code
 * syntax, as CSS custom properties, collection by collection.
 *
 * - A collection whose modes are the fluid Min and Max goes in `:root`. Where both modes resolve
 *   to the same named token, the value is its `var()`; otherwise both resolve to px, and the value
 *   is a `clamp()` across the Utopia viewport (or one size, when they're equal).
 * - A collection with one mode goes in `:root`.
 * - Any other collection: the default mode in `:root`, and a block for each other mode holding
 *   only what that mode changes (and whatever refers to it), with the selector from
 *   `build.semantics.modes`. A mode that changes nothing needs no selector.
 *
 * Sizes are written in rem, except tokens scoped only to line height, opacity or font weight,
 * which stay unitless numbers.
 */
import type { Dictionary } from 'style-dictionary/types';
import type { TokensConfig } from '../config.js';
export declare function semanticsScss({ dictionary, options, }: {
    dictionary: Dictionary;
    options: Record<string, unknown> & {
        tokens: TokensConfig;
    };
}): string;
