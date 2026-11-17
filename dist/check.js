/**
 * `s58-tokens check`: read only, for CI. It reports:
 *
 * - generated files that don't match the configs (someone edited a config or a Figma export and
 *   didn't rebuild, or edited a generated file by hand);
 * - semantic tokens with code syntax whose value is raw instead of a reference: semantics point
 *   only at primitives or at other semantics;
 * - APCA floors a generated scale misses, unless the config accepts that miss;
 * - a plugin manifest whose name or id doesn't match the config.
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtFiles, dtcgFiles } from './outputs.js';
import { generatedApcaFailures } from './palette/report.js';
import { tokenTree } from './style-dictionary/index.js';
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
function outOfDate(files, root) {
    return files.flatMap(({ destination, output }) => {
        const file = path.join(root, destination);
        if (!fs.existsSync(file))
            return [`${destination} is missing. Run s58-tokens build.`];
        return fs.readFileSync(file, 'utf8') === output
            ? []
            : [`${destination} doesn't match the configs. Run s58-tokens build.`];
    });
}
/** Semantic tokens (under `color` and the fluid semantic groups) with code syntax and a raw value. */
function rawSemantics(config, root) {
    const tree = tokenTree(config, root);
    const problems = [];
    const walk = (node, at) => {
        if (!isRecord(node))
            return;
        if ('$value' in node) {
            const hasName = isRecord(node.$extensions) && 'com.figma.codeSyntax' in node.$extensions;
            const value = node.$value;
            if (hasName && !(typeof value === 'string' && /^\{.+\}$/.test(value))) {
                problems.push(`${at.join('.')} has a raw value; semantics should reference a primitive or another semantic.`);
            }
            return;
        }
        for (const [key, child] of Object.entries(node))
            walk(child, [...at, key]);
    };
    walk(tree.color, ['color']);
    const fluid = tree.fluid;
    for (const group of config.build?.semantics?.fluid?.groups ?? []) {
        if (isRecord(fluid))
            walk(fluid[group], ['fluid', group]);
    }
    return problems;
}
/** `amber 6: Lc 39.7 on white, below 40` → `amber 6 on white`. */
const apcaKey = (failure) => failure.replace(/^(\S+ \d+): Lc [\d.]+ (on \w+),.*$/, '$1 $2');
function apcaMisses(config) {
    const allowed = new Set(config.check?.allowApcaMisses ?? []);
    const { failures } = generatedApcaFailures(config.palette);
    return {
        problems: failures
            .filter((f) => !allowed.has(apcaKey(f)))
            .map((f) => `APCA floor missed: ${f}. Fix the scale, or accept it in check.allowApcaMisses.`),
        accepted: failures.filter((f) => allowed.has(apcaKey(f))),
    };
}
function manifestProblems(config, root) {
    const file = path.join(config.figma.plugin.dir ?? 'design-tokens/figma-plugin', 'manifest.json');
    if (!fs.existsSync(path.join(root, file)))
        return [];
    const manifest = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    const { name, id } = config.figma.plugin;
    return manifest.name === name && manifest.id === id
        ? []
        : [
            `${file} names the plugin "${manifest.name}" (${manifest.id}); the config says "${name}" (${id}).`,
        ];
}
export async function checkTokens(config, root = process.cwd()) {
    const apca = apcaMisses(config);
    return {
        problems: [
            ...outOfDate([...dtcgFiles(config), ...(await builtFiles(config, root))], root),
            ...rawSemantics(config, root),
            ...apca.problems,
            ...manifestProblems(config, root),
        ],
        notes: apca.accepted.map((f) => `Accepted APCA miss: ${f}`),
    };
}
