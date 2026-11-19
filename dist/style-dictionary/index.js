/**
 * The build: the generated primitives and Figma's semantic exports, as one DTCG tree, through Style
 * Dictionary into the files the project lists in `build.files`.
 */
import fs from 'node:fs';
import path from 'node:path';
import StyleDictionary from 'style-dictionary';
import { figmaColourTokens, figmaFluidTokens, mergeTrees, pulledColourTokens, pulledFluidTokens, } from '../dtcg/figma.js';
import { generateDtcg } from '../dtcg/generate.js';
import { formatOklch } from '../palette/colour.js';
import { cssNameOf, packageFormats } from './formats.js';
const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
export const isPulled = (semantics) => !!semantics && 'file' in semantics;
/** The semantic groups the build reads from the fluid collection. */
export const fluidSemanticGroups = (semantics) => semantics?.fluid?.groups ?? [];
function semanticTrees(semantics, root) {
    if (!semantics)
        return [];
    if (isPulled(semantics)) {
        const json = readJson(root, semantics.file);
        const { colours, fluid } = semantics;
        return [
            ...(colours ? [pulledColourTokens(json, colours.collection, colours.modes)] : []),
            ...(fluid ? [pulledFluidTokens(json, fluid.collection, fluid.mode, fluid.groups)] : []),
        ];
    }
    return [
        ...Object.entries(semantics.colours ?? {}).map(([mode, file]) => figmaColourTokens(readJson(root, file), mode)),
        ...(semantics.fluid
            ? [figmaFluidTokens(readJson(root, semantics.fluid.file), semantics.fluid.groups)]
            : []),
    ];
}
/** The whole token tree the build reads: generated primitives plus Figma's semantics. */
export function tokenTree(config, root = process.cwd()) {
    return mergeTrees(...Object.values(generateDtcg(config)), ...semanticTrees(config.build?.semantics, root));
}
/** Every file in `build.files`, formatted, without writing anything. */
export async function buildTokenFiles(config, root = process.cwd()) {
    const build = config.build;
    if (!build)
        return [];
    const formats = {};
    for (const [name, format] of Object.entries({ ...packageFormats, ...build.formats })) {
        formats[name] = (args) => format(args);
    }
    const sd = new StyleDictionary({
        tokens: tokenTree(config, root),
        usesDtcg: true,
        log: { verbosity: 'silent', warnings: 'disabled' },
        hooks: {
            formats,
            transforms: {
                's58/name/code-syntax': {
                    type: 'name',
                    transform: (t) => cssNameOf(t) ?? t.path.join('-'),
                },
                's58/color/oklch': {
                    type: 'value',
                    filter: (t) => {
                        const v = t.original.$value;
                        return t.$type === 'color' && typeof v === 'object' && v?.colorSpace === 'oklch';
                    },
                    transform: (t) => {
                        const { components, alpha } = t.original.$value;
                        const [l, c, h] = components;
                        return formatOklch({ l, c, h, alpha });
                    },
                },
            },
        },
        platforms: {
            s58: {
                transforms: ['s58/name/code-syntax', 's58/color/oklch'],
                files: build.files.map((file) => ({
                    destination: file.destination,
                    format: file.format,
                    options: { ...file.options, tokens: config },
                })),
            },
        },
    });
    const outputs = (await sd.formatPlatform('s58'));
    return outputs.map((o) => ({ destination: String(o.destination), output: String(o.output) }));
}
