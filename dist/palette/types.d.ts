/**
 * The palette's types and its default rules. A project's palette config (definePalette) gives the
 * scales and anything that differs from the defaults. See the README, Palette.
 */
/** A single colour in OKLCH. `alpha` is 0 to 1 and defaults to 1. */
export interface Oklch {
    l: number;
    c: number;
    h: number;
    alpha?: number;
}
/** A scale of one hue with every step given, lightest first. */
export interface ColourScale {
    /** Hue angle in degrees, the same for every step. */
    hue: number;
    /** The brand step for this scale, written as `<scale>/ref`: a step number, or its own colour. */
    ref?: number | Oklch;
    /** Lightness per step, lightest first. */
    lightness: readonly number[];
    /** Chroma per step, before gamut fitting. */
    chroma: readonly number[];
}
/** A scale generated from one reference colour. A plain string is the same as `{ colour }`. */
export interface ReferenceScale {
    /** The scale's brand colour: a hex code (`#F3A512`, sRGB) or `oklch(L C H)`. */
    colour: string;
    /** The step the reference sits at. By default, the step nearest its own contrast on white. */
    refStep?: number;
    /** Neutrals: spread lightness evenly from the first value (step 1) to the second (the last step). */
    range?: readonly [number, number];
    /** Steps set by hand: lightness (`l`) and chroma (`c`) in OKLCH. */
    overrides?: Readonly<Record<number, {
        l?: number;
        c?: number;
    }>>;
}
/** A scale: generated from a reference colour, or (`ColourScale`) every step given. */
export type ScaleInput = string | ReferenceScale | ColourScale;
/** The rules that turn a reference colour into a scale. */
export interface PaletteRules {
    /** WCAG 2 contrast on white for each step, lightest first. 4.5 is AA body text, 3 large text and UI. */
    contrastOnWhite: readonly number[];
    /** Chroma at the first and last step, as a fraction of the reference's chroma. */
    chroma: {
        lightest: number;
        darkest: number;
    };
    /**
     * APCA floors the scales must meet, as step: Lc. `onBlack` is text in that colour on black (that
     * step and every lighter one); `onWhite` is text on white (that step and every darker one). APCA
     * isn't symmetric, so dark mode is checked on its own. Lc 75 is the minimum for body text, 60
     * other text, 45 large text.
     */
    apca?: {
        onBlack?: Readonly<Record<number, number>>;
        onWhite?: Readonly<Record<number, number>>;
    };
}
/** The gamut colours are fitted into. */
export type Gamut = 'srgb' | 'p3';
/** A scale and step number, such as `['charcoal', 15]`, where one colour points at another. */
export type ScaleStep = readonly [string, number];
/** Transparent versions of one colour, named by opacity (`a07` is 7%). */
export interface AlphaScale {
    colour: Oklch;
    /** Written as `<scale>/ref`, when the scale has one. */
    ref?: ScaleStep;
    /** Opacities in percent. */
    alphas: readonly number[];
}
/** Where the palette goes in Figma. */
export interface PaletteFigma {
    collection: string;
    /** The group every scale goes in, such as `primitive/colors`. */
    group: string;
    /** Figma's documentColorProfile the variables are written for, such as `DISPLAY_P3`. */
    colorProfile: string;
    /** The variables' scopes, such as fills and strokes. Empty hides them from every picker. */
    scopes: readonly string[];
}
/** Everything the palette generator needs. */
export interface PaletteConfig {
    scales: Readonly<Record<string, ScaleInput>>;
    rules: PaletteRules;
    /** Fixed colours. A `ScaleStep` is an alias to that step; an `Oklch` is a colour of its own. */
    general: Readonly<Record<string, ScaleStep | Oklch>>;
    alphas: Readonly<Record<string, AlphaScale>>;
    steps: number;
    gamut: Gamut;
    figma: PaletteFigma;
}
/**
 * The default ladder: started on 2026-11-16 from the median contrast of S58 Marketing's 12 hues at
 * each step, with step 8 at 3 (large text and UI) and step 10 at 4.5 (AA body text), and chroma
 * from those hues' medians.
 *
 * WCAG 2 contrast on black is 21 ÷ contrast on white, so steps 1 to 10 pass AA on black too. APCA
 * is stricter on black: body text (Lc 75) on black needs steps 1 to 3, and step 10 is only Lc 31
 * there. The APCA floors are what this ladder guarantees in every hue.
 */
export declare const defaultPaletteRules: PaletteRules;
/** Fills it out with the defaults (15 steps, the default rules, Display P3) and checks the shape. */
export declare function definePalette(config: Partial<PaletteConfig> & Pick<PaletteConfig, 'scales'>): PaletteConfig;
