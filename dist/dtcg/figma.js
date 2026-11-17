/**
 * Figma's own variable exports (File > Export > Variables, one file per mode) turned into DTCG that
 * sits next to the generated primitives:
 *
 * - A colour export goes under `color.<mode>`, so light and dark live in one tree. A colour Figma
 *   aliases to `primitive/colors/amber/6` becomes the reference `{primitive.colors.amber.6}`, which
 *   the generated palette defines. Figma's resolved values are dropped: in a Display P3 file they're
 *   P3 numbers labelled `srgb`.
 * - The Fluid tokens export goes under `fluid`, keeping only the semantic groups (Buttons, Forms…).
 *   The code-owned groups (Font size, Space size, the pairs) come from the generated tokens instead.
 *
 * References inside a file get the same prefix. Each token keeps its type and its code syntax.
 */
import { CODE_SYNTAX_EXTENSION } from './generate.js';
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
function convert(node, prefix) {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('$') || key.startsWith('com.') || !isRecord(value))
            continue;
        if (!('$value' in value)) {
            out[key] = convert(value, prefix);
            continue;
        }
        const extensions = isRecord(value.$extensions) ? value.$extensions : {};
        const alias = isRecord(extensions['com.figma.aliasData'])
            ? extensions['com.figma.aliasData'].targetVariableName
            : undefined;
        const raw = value.$value;
        const $value = typeof raw === 'string' && /^\{.+\}$/.test(raw)
            ? `{${prefix}.${raw.slice(1, -1)}}`
            : typeof alias === 'string' && alias.startsWith('primitive/')
                ? `{${alias.split('/').join('.')}}`
                : raw;
        const token = { $type: value.$type, $value: $value };
        if (isRecord(extensions[CODE_SYNTAX_EXTENSION])) {
            token.$extensions = { [CODE_SYNTAX_EXTENSION]: extensions[CODE_SYNTAX_EXTENSION] };
        }
        out[key] = token;
    }
    return out;
}
/** One mode of Figma's colour export, under `color.<mode>`. */
export function figmaColourTokens(json, mode) {
    return { color: { [mode]: convert(json, `color.${mode}`) } };
}
/** The semantic groups of Figma's Fluid tokens export, in the order given, under `fluid`. */
export function figmaFluidTokens(json, groups) {
    const picked = {};
    for (const group of groups) {
        if (!isRecord(json[group]))
            throw new Error(`The Fluid tokens export has no ${group} group`);
        picked[group] = json[group];
    }
    return { fluid: convert(picked, 'fluid') };
}
/** Merges DTCG trees, group by group. A token defined twice is an error. */
export function mergeTrees(...trees) {
    const out = {};
    const merge = (into, from, path) => {
        for (const [key, value] of Object.entries(from)) {
            const existing = into[key];
            if (existing === undefined) {
                into[key] = value;
            }
            else if (isRecord(existing) &&
                isRecord(value) &&
                !('$value' in existing) &&
                !('$value' in value)) {
                merge(existing, value, [...path, key]);
            }
            else {
                throw new Error(`Two token sources define ${[...path, key].join('.')}`);
            }
        }
    };
    for (const tree of trees)
        merge(out, structuredClone(tree), []);
    return out;
}
