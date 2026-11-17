import { type StarterOptions } from './templates.js';
export { PLACEHOLDER_COLOURS, slugOf, starterFiles, type StarterOptions } from './templates.js';
/** Writes the starter files under `root` and returns their paths. */
export declare function initProject(options: StarterOptions, { root, force }?: {
    root?: string;
    force?: boolean;
}): string[];
