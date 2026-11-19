/**
 * The palette generator: turns a palette config (definePalette) into a list of colours, each fitted
 * to the gamut. CSS and Figma (figma/variables.ts) both read this list.
 */
import { fitToGamut } from './colour.js';
import { generateScale } from './scale.js';
const isStep = (v) => Array.isArray(v);
export const alphaName = (percent) => `a${String(percent).padStart(2, '0')}`;
const isExplicit = (s) => typeof s === 'object' && 'lightness' in s;
/** Every scale with all its steps: given ones as they are, the rest generated from their reference. */
export function resolveScales(config) {
    return Object.fromEntries(Object.entries(config.scales).map(([group, s]) => [
        group,
        isExplicit(s) ? s : generateScale(s, config.rules, config.gamut, group),
    ]));
}
/** Every colour in the palette, in the order CSS and Figma list them. */
export function buildPalette(config) {
    const scaleColours = new Map();
    const scaleList = [];
    const scales = resolveScales(config);
    for (const [group, scale] of Object.entries(scales)) {
        for (const key of ['lightness', 'chroma']) {
            if (scale[key].length !== config.steps) {
                throw new Error(`${group}.${key} has ${scale[key].length} values; it needs ${config.steps}`);
            }
        }
        for (let i = 0; i < config.steps; i++) {
            const configured = { l: scale.lightness[i], c: scale.chroma[i], h: scale.hue };
            const entry = {
                group,
                name: String(i + 1),
                colour: fitToGamut(configured, config.gamut),
                configured,
            };
            scaleColours.set(`${group}/${entry.name}`, entry);
            scaleList.push(entry);
        }
    }
    const stepColour = ([group, step], from) => {
        const target = scaleColours.get(`${group}/${step}`);
        if (!target)
            throw new Error(`${from} points at ${group} ${step}, which isn't in the palette`);
        return target;
    };
    const alias = (group, name, step) => {
        const target = stepColour(step, `${group}/${name}`);
        return {
            group,
            name,
            colour: target.colour,
            configured: target.configured,
            aliasOf: { group: target.group, name: target.name },
        };
    };
    const own = (group, name, configured) => ({
        group,
        name,
        colour: fitToGamut(configured, config.gamut),
        configured,
    });
    const general = Object.entries(config.general).map(([name, v]) => isStep(v) ? alias('general', name, v) : own('general', name, v));
    const alphas = Object.entries(config.alphas).flatMap(([group, scale]) => [
        ...scale.alphas.map((percent) => own(group, alphaName(percent), { ...scale.colour, alpha: percent / 100 })),
        ...(scale.ref ? [alias(group, 'ref', scale.ref)] : []),
    ]);
    const refs = new Map();
    for (const [group, scale] of Object.entries(scales)) {
        if (scale.ref === undefined)
            continue;
        refs.set(group, typeof scale.ref === 'number'
            ? alias(group, 'ref', [group, scale.ref])
            : own(group, 'ref', scale.ref));
    }
    const scalesWithRefs = Object.keys(scales).flatMap((group) => [
        ...(refs.has(group) ? [refs.get(group)] : []),
        ...scaleList.filter((c) => c.group === group),
    ]);
    return [...general, ...alphas, ...scalesWithRefs];
}
