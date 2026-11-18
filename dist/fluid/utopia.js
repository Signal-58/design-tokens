/** Checks that both scales use the viewport, and returns the config. */
export function defineUtopia(config) {
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
