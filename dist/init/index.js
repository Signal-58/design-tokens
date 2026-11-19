/**
 * `s58-tokens init`: a new project's design-tokens/ folder, from the starter templates, plus the
 * Figma plugin's manifest. It never overwrites a file unless asked.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileKeyFrom } from '../figma/file-key.js';
import { pluginManifest } from '../figma/manifest.js';
import { parseColour } from '../palette/colour.js';
import { slugOf, starterFiles } from './templates.js';
export { PLACEHOLDER_COLOURS, slugOf, starterFiles } from './templates.js';
/** Writes the starter files under `root` and returns their paths. */
export function initProject(options, { root = process.cwd(), force = false } = {}) {
    if (!options.name.trim())
        throw new Error('init needs the project name: --name="Acme"');
    for (const key of ['brand', 'accent', 'neutral']) {
        const colour = options[key];
        if (colour) {
            try {
                parseColour(colour);
            }
            catch {
                throw new Error(`--${key}=${colour} isn't a hex code or oklch(L C H)`);
            }
        }
    }
    if (options.fileKey) {
        try {
            options = { ...options, fileKey: fileKeyFrom(options.fileKey) };
        }
        catch (error) {
            throw new Error(`--file-key: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    const id = options.id ?? `${slugOf(options.name)}-tokens-dev`;
    const files = {
        ...starterFiles({ ...options, id }),
        'design-tokens/figma-plugin/manifest.json': pluginManifest({
            name: `${options.name} Tokens`,
            id,
        }),
    };
    const existing = Object.keys(files).filter((f) => fs.existsSync(path.join(root, f)));
    if (existing.length && !force) {
        throw new Error(`These files exist already (--force overwrites them):\n  ${existing.join('\n  ')}`);
    }
    for (const [file, contents] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        fs.writeFileSync(path.join(root, file), contents);
    }
    return Object.keys(files);
}
