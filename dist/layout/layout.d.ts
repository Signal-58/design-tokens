import type { TokensConfig } from '../config.js';
import { type Exactly } from '../keys.js';
import type { VariablesSpec } from '../figma/variables.js';
/** Where a pair of primitives goes: one group for the min viewport, one for the max. */
interface MinMaxGroups {
    collection: string;
    minGroup: string;
    maxGroup: string;
}
export interface LayoutSizes {
    collection: string;
    /** The group the sizes go in: `Hero`. */
    group: string;
    /** Name → px: `{ Small: 550 }` writes `<group>/Small`. */
    values: Readonly<Record<string, number>>;
    /**
     * Optional: build the sizes into CSS too, as `--<prefix>-<name in kebab case>` in px
     * (`--hero-size-small: 550px`). `omit` lists sizes only Figma uses.
     */
    css?: {
        prefix: string;
        omit?: readonly string[];
    };
}
export interface LayoutConfig {
    /** The Utopia viewport's widths as two variables: `{ collection, min: 'Layout @min/viewport', max: … }`. */
    viewport?: {
        collection: string;
        min: string;
        max: string;
    };
    /**
     * Border widths as aliases to the space primitives, by Utopia size label or fixed size:
     * `widths: { 1: '7xs', 2: '5xs' }` writes `<minGroup>/1` → `Space @min/7XS`, and so on.
     */
    borderWidths?: MinMaxGroups & {
        widths: Readonly<Record<string, string>>;
    };
    /**
     * Line heights as ratios, one per name, from the typography config's line height rules:
     * `values: { Default: { rule: 'copy', step: 0 } }`. Both viewports get the same ratio.
     */
    lineHeights?: MinMaxGroups & {
        values: Readonly<Record<string, {
            rule: string;
            step: number;
        }>>;
    };
    /** Fixed sizes in px, a group each. */
    sizes?: readonly LayoutSizes[];
}
/** Checks the config, including that it has no unknown or misspelt keys, and returns it. */
export declare function defineLayout<const T extends LayoutConfig>(config: T & Exactly<T, LayoutConfig>): T;
type Collection = VariablesSpec['collections'][number];
/**
 * The layout primitives as variables, a collection fragment each, for `buildVariablesSpec`'s
 * collections to absorb (`mergeCollections`).
 */
export declare function layoutVariables(config: TokensConfig): Collection[];
/** The CSS name of a size: `hero-size` and `XLarge` → `hero-size-xlarge`. */
export declare const sizeCssName: (prefix: string, name: string) => string;
export {};
