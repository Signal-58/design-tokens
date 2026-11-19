/**
 * Generates a scale from one reference colour, one step per contrast target.
 *
 * - Lightness: each step is solved to hit its contrast on white from `paletteRules.contrastOnWhite`,
 *   so step N has the same contrast in every hue.
 * - Chroma: rises in a straight line from `chroma.lightest` × the reference's chroma at step 1 to the
 *   reference's chroma at its step, then falls to `chroma.darkest` × at step 15. Each colour is
 *   fitted to the gamut, and its lightness solved again, so the fit doesn't change its contrast.
 * - The reference itself sits at the step nearest its own contrast (or `refStep`), unchanged.
 * - Neutrals with a `range` spread lightness evenly across it instead, at the reference's chroma.
 * - `overrides` set a step's lightness or chroma by hand, last.
 */
import type { ColourScale, Oklch, PaletteRules, ReferenceScale, Gamut } from './types.js';
/** The step (1 to n) whose target contrast is nearest the colour's own, on a log scale. */
export declare function nearestStep(colour: Oklch, targets: readonly number[]): number;
export declare function generateScale(input: string | ReferenceScale, rules: PaletteRules, gamut: Gamut, name?: string): ColourScale;
/**
 * The APCA floors in `rules.apca` a scale misses: text on black at a step and every lighter one,
 * text on white at a step and every darker one. Empty when it meets them all.
 */
export declare function apcaFailures(scale: ColourScale, rules: PaletteRules, name?: string): string[];
