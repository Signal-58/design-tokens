import type { ColourScale, Oklch, PaletteConfig } from './types.js';
export interface PaletteColour {
    /** The group in Figma and CSS: `amber`, `black_alpha`, `general`. */
    group: string;
    /** The name in the group: `6`, `ref`, `a07`, `black_pure`. */
    name: string;
    /** The colour after gamut fitting. For an alias, the colour it points at. */
    colour: Oklch;
    /** The colour as configured, before fitting. */
    configured: Oklch;
    /** For an alias: the group and name it points at. */
    aliasOf?: {
        group: string;
        name: string;
    };
}
export declare const alphaName: (percent: number) => string;
/** Every scale with all its steps: given ones as they are, the rest generated from their reference. */
export declare function resolveScales(config: Omit<PaletteConfig, 'figma'>): Record<string, ColourScale>;
/** Every colour in the palette, in the order CSS and Figma list them. */
export declare function buildPalette(config: Omit<PaletteConfig, 'figma'>): PaletteColour[];
