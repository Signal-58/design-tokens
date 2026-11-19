/**
 * The palette's types and its default rules. A project's palette config (definePalette) gives the
 * scales and anything that differs from the defaults. See the README, Palette.
 */
import { checkColourScopes } from '../figma/scopes.js';
import { checkKeys, keysOf } from '../keys.js';
/**
 * The default ladder: started on 2026-11-16 from the median contrast of S58 Marketing's 12 hues at
 * each step, with step 8 at 3 (large text and UI) and step 10 at 4.5 (AA body text), and chroma
 * from those hues' medians.
 *
 * WCAG 2 contrast on black is 21 ÷ contrast on white, so steps 1 to 10 pass AA on black too. APCA
 * is stricter on black: body text (Lc 75) on black needs steps 1 to 3, and step 10 is only Lc 31
 * there. The APCA floors are what this ladder guarantees in every hue.
 */
export const defaultPaletteRules = {
    contrastOnWhite: [1.1, 1.25, 1.45, 1.65, 1.9, 2.25, 2.6, 3, 3.6, 4.5, 5.2, 6.2, 7.4, 8.9, 10.7],
    chroma: { lightest: 0.13, darkest: 0.31 },
    apca: {
        onBlack: { 3: 75, 5: 60, 8: 45 },
        onWhite: { 6: 40, 9: 60, 12: 75 },
    },
};
const PALETTE_KEYS = keysOf()('scales', 'rules', 'general', 'alphas', 'steps', 'gamut', 'figma');
const PALETTE_FIGMA_KEYS = keysOf()('collection', 'group', 'colorProfile', 'scopes');
/**
 * Fills it out with the defaults (15 steps, the default rules, Display P3) and checks the shape,
 * including that it has no unknown or misspelt keys.
 */
export function definePalette(config) {
    checkKeys('palette', config, PALETTE_KEYS);
    checkKeys('palette.figma', config.figma, PALETTE_FIGMA_KEYS);
    if (config.figma)
        checkColourScopes('palette.figma.scopes', config.figma.scopes);
    const resolved = {
        rules: defaultPaletteRules,
        general: {},
        alphas: {},
        steps: 15,
        gamut: 'p3',
        figma: {
            collection: 'Primitives',
            group: 'primitive/colors',
            colorProfile: 'DISPLAY_P3',
            scopes: ['ALL_FILLS', 'STROKE_COLOR'],
        },
        ...config,
    };
    if (resolved.rules.contrastOnWhite.length !== resolved.steps) {
        throw new Error(`rules.contrastOnWhite has ${resolved.rules.contrastOnWhite.length} values; the palette has ${resolved.steps} steps`);
    }
    return resolved;
}
