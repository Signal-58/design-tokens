/**
 * Utopia fluid type and space: the viewport and the two scales, calculated with utopia-core, the
 * same maths as utopia.fyi. A project's utopia config (defineUtopia) holds the values.
 */
import type { UtopiaSpaceConfig, UtopiaTypeConfig } from 'utopia-core';
import { type Exactly } from '../keys.js';
export type { UtopiaSpaceConfig, UtopiaTypeConfig };
/** The viewport range the scales are fluid across, in px. */
export interface UtopiaViewport {
    minWidth: number;
    maxWidth: number;
    /** What the fluid part of `clamp()` is relative to, as utopia-core-scss names it. */
    relativeTo: 'viewport-width' | 'container' | 'viewport';
}
export interface UtopiaConfig {
    viewport: UtopiaViewport;
    type: UtopiaTypeConfig;
    space: UtopiaSpaceConfig;
}
/**
 * Checks that both scales use the viewport, and that it has no unknown or misspelt keys, and
 * returns the config.
 */
export declare function defineUtopia<const T extends UtopiaConfig>(config: T & Exactly<T, UtopiaConfig>): T;
