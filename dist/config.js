/**
 * The token config: one file per project, `design-tokens/tokens.config.ts`, that brings the module
 * configs together with what belongs to the project as a whole.
 */
import path from 'node:path';
import { createJiti } from 'jiti';
import { fileKeyFrom, isFileKey } from './figma/file-key.js';
import { buildTextStyleSpec } from './figma/text-styles.js';
import { buildVariablesSpec, paletteVariables, } from './figma/variables.js';
import { buildPalette } from './palette/palette.js';
/** Checks the config and returns it. The CLI reads it as the default export of tokens.config.ts. */
export function defineTokens(config) {
    if (!/^[a-z0-9-]+$/.test(config.figma.plugin.id)) {
        throw new Error(`figma.plugin.id must be lowercase letters, digits and hyphens: ${config.figma.plugin.id}`);
    }
    const { fileKey } = config.figma;
    if (fileKey && !isFileKey(fileKey)) {
        let hint = '';
        try {
            hint = ` Use '${fileKeyFrom(fileKey)}'.`;
        }
        catch {
            // Not a link either: the message says what a key looks like.
        }
        throw new Error(`figma.fileKey must be the file's key, the part of its link after /design/: ${fileKey}.${hint}`);
    }
    return config;
}
export const DEFAULT_CONFIG_PATH = 'design-tokens/tokens.config.ts';
/**
 * Loads a project's token config with jiti, so it can stay TypeScript and import the other configs.
 * `fresh` skips jiti's caches, for watch mode.
 */
export async function loadTokensConfig(file = DEFAULT_CONFIG_PATH, { fresh = false } = {}) {
    const absolute = path.resolve(file);
    const jiti = createJiti(import.meta.url, { moduleCache: !fresh, fsCache: !fresh });
    const config = await jiti.import(absolute, { default: true });
    if (!config || typeof config !== 'object' || !('palette' in config)) {
        throw new Error(`${file} must export a token config (defineTokens) as its default export`);
    }
    return config;
}
/** The Figma file the project's plugin and use_figma scripts may touch. */
export function fileGuardFor(config) {
    const { fileKey, fileName } = config.figma;
    return { project: config.name, fileKey, ...(fileName ? { fileName } : {}) };
}
/** The variables module's spec for a project: Utopia, letter spacing and colour primitives. */
export function variablesSpecFor(config) {
    const { utopia, figmaVariables, typography, palette } = config;
    return buildVariablesSpec(utopia.type, utopia.space, figmaVariables, typography.letterSpacingScale, paletteVariables(buildPalette(palette), palette.figma), palette.figma.colorProfile);
}
/** The text styles module's spec for a project, for all roles or the ones named. */
export function textStylesSpecFor(config, roles) {
    const all = config.typography.roles;
    if (roles) {
        const unknown = roles.filter((r) => !(r in all));
        if (unknown.length)
            throw new Error(`Unknown roles: ${unknown.join(', ')}`);
    }
    const picked = roles ? Object.fromEntries(roles.map((r) => [r, all[r]])) : all;
    return buildTextStyleSpec(picked, config.typography.fonts, config.typography.figma);
}
