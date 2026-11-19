import { type PaletteColour } from './palette.js';
import type { PaletteConfig } from './types.js';
export declare function paletteReport(config: Omit<PaletteConfig, 'figma'>, palette?: PaletteColour[]): string;
/**
 * The APCA floors generated scales miss. The floors are what the rules guarantee for generated
 * hues; scales given step by step and neutral ranges aren't held to them.
 */
export declare function generatedApcaFailures(config: Omit<PaletteConfig, 'figma'>): {
    checked: string[];
    failures: string[];
};
