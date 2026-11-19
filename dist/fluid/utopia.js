import { checkKeys, keysOf } from '../keys.js';
const UTOPIA_KEYS = keysOf()('viewport', 'type', 'space');
const VIEWPORT_KEYS = keysOf()('minWidth', 'maxWidth', 'relativeTo');
/**
 * Checks that both scales use the viewport, and that it has no unknown or misspelt keys, and
 * returns the config.
 */
export function defineUtopia(config) {
    checkKeys('utopia', config, UTOPIA_KEYS);
    checkKeys('utopia.viewport', config.viewport, VIEWPORT_KEYS);
    for (const [name, scale] of [
        ['type', config.type],
        ['space', config.space],
    ]) {
        if (scale.minWidth !== config.viewport.minWidth ||
            scale.maxWidth !== config.viewport.maxWidth) {
            throw new Error(`The ${name} scale runs from ${scale.minWidth}px to ${scale.maxWidth}px; the viewport is ${config.viewport.minWidth}px to ${config.viewport.maxWidth}px`);
        }
    }
    return config;
}
