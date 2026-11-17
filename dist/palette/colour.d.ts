/**
 * Colour maths for the palette generator: OKLCH to sRGB and Display P3, gamut fitting and contrast.
 * Matrices from Björn Ottosson's OKLab and CSS Color 4 (D65 white point throughout).
 */
import type { Gamut, Oklch } from './types.js';
type Vec3 = readonly [number, number, number];
/** OKLCH to CIE XYZ (D65). */
export declare function oklchToXyz({ l, c, h }: Oklch): Vec3;
/** Linear-light RGB in a gamut. Values outside 0 to 1 are out of that gamut. */
export declare function oklchToLinear(colour: Oklch, gamut: Gamut): Vec3;
/** Gamma-encoded RGB, 0 to 1, clamped. Use after fitting so the clamp doesn't shift the hue. */
export declare function oklchToRgb(colour: Oklch, gamut: Gamut): {
    r: number;
    g: number;
    b: number;
};
export declare function inGamut(colour: Oklch, gamut: Gamut): boolean;
/**
 * The colour with its chroma reduced just enough to fit the gamut, keeping lightness and hue,
 * rounded to 4 decimal places. Colours already inside are returned unchanged.
 */
export declare function fitToGamut(colour: Oklch, gamut: Gamut): Oklch;
/** Relative luminance (CIE Y), the basis of WCAG 2 contrast. */
export declare const luminance: (colour: Oklch) => number;
/** WCAG 2 contrast ratio between two opaque colours, 1 to 21. */
export declare function contrastRatio(a: Oklch, b: Oklch): number;
/** Difference in OKLab, ×100 so 2 is a just-noticeable difference. */
export declare function deltaE(a: Oklch, b: Oklch): number;
/** `oklch(L C H)` or `oklch(L C H / A%)`, numbers trimmed. */
export declare function formatOklch({ l, c, h, alpha }: Oklch): string;
/**
 * Screen luminance for APCA (APCA-W3 0.0.98G): the colour's Display P3 channels, as a P3 screen
 * shows them, with APCA's simple 2.4 exponent and P3 coefficients.
 */
export declare function apcaLuminance(colour: Oklch): number;
/**
 * APCA lightness contrast (Lc) of text on a background, APCA-W3 0.0.98G. Positive for dark text on a
 * light background, negative for light text on a dark one; compare the size (Lc 75 is the
 * minimum for body text, 60 for other text, 45 for large text, 15 for non-text). Unlike WCAG 2 it
 * isn't symmetric, so contrast on black is measured, not derived from contrast on white.
 */
export declare function apcaContrast(text: Oklch, background: Oklch): number;
/** CIE XYZ (D65) to OKLCH. Hue is 0 for greys. */
export declare function xyzToOklch(xyz: Vec3): Oklch;
/**
 * A colour from a hex code (`#F3A512`, `#fa1`, read as sRGB, the CSS default) or `oklch(L C H)`
 * (L as 0.78 or 78%), rounded to 4 decimal places (hue to 2). Anything else throws, rather than
 * quietly becoming black.
 */
export declare function parseColour(input: string): Oklch;
export {};
