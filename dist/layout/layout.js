/**
 * The layout config (`defineLayout`, `design-tokens/layout.config.ts`): primitives that aren't
 * Utopia steps or colours, but which Figma's semantics alias. The plugin writes them, like the
 * space scale, so every semantic points at a primitive code owns:
 *
 * - `viewport`: the Utopia viewport's two widths, from the utopia config;
 * - `borderWidths`: each width as an alias to a space primitive, at both viewports;
 * - `lineHeights`: ratios from the typography config's line height rules, the same at both
 *   viewports;
 * - `sizes`: fixed sizes in px, such as hero heights. A group with `css` is also built into CSS
 *   custom properties (`s58/scss/layout`), so code and Figma read the same numbers.
 *
 * Every part is optional, and each keeps the variable names the file already has, so aliases to
 * them stay.
 */
import { calculateSpaceScale, calculateTypeScale } from 'utopia-core';
import { checkKeys, keysOf } from '../keys.js';
import { kebab } from '../semantics/rules.js';
import { buildLineHeightScales } from '../type/rules.js';
const LAYOUT_KEYS = keysOf()('viewport', 'borderWidths', 'lineHeights', 'sizes');
const VIEWPORT_KEYS = keysOf()('collection', 'min', 'max');
const BORDER_KEYS = keysOf()('collection', 'minGroup', 'maxGroup', 'widths');
const LINE_HEIGHT_KEYS = keysOf()('collection', 'minGroup', 'maxGroup', 'values');
const LINE_HEIGHT_VALUE_KEYS = keysOf()('rule', 'step');
const SIZES_KEYS = keysOf()('collection', 'group', 'values', 'css');
const SIZES_CSS_KEYS = keysOf()('prefix', 'omit');
/** Checks the config, including that it has no unknown or misspelt keys, and returns it. */
export function defineLayout(config) {
    checkKeys('layout', config, LAYOUT_KEYS);
    checkKeys('layout.viewport', config.viewport, VIEWPORT_KEYS);
    checkKeys('layout.borderWidths', config.borderWidths, BORDER_KEYS);
    checkKeys('layout.lineHeights', config.lineHeights, LINE_HEIGHT_KEYS);
    for (const [name, value] of Object.entries(config.lineHeights?.values ?? {})) {
        checkKeys(`layout.lineHeights.values.${name}`, value, LINE_HEIGHT_VALUE_KEYS);
    }
    if (config.sizes !== undefined && !Array.isArray(config.sizes)) {
        throw new Error('layout.sizes must be a list: [{ collection, group, values, css? }]');
    }
    for (const [i, sizes] of (config.sizes ?? []).entries()) {
        checkKeys(`layout.sizes[${i}]`, sizes, SIZES_KEYS);
        checkKeys(`layout.sizes[${i}].css`, sizes.css, SIZES_CSS_KEYS);
        for (const [name, px] of Object.entries(sizes.values)) {
            if (typeof px !== 'number' || !Number.isFinite(px)) {
                throw new Error(`layout.sizes: ${sizes.group}/${name} must be a number of px`);
            }
        }
        const unknown = (sizes.css?.omit ?? []).filter((name) => !(name in sizes.values));
        if (unknown.length) {
            throw new Error(`layout.sizes: ${sizes.group}'s css.omit names no size: ${unknown.join(', ')}`);
        }
    }
    return config;
}
/**
 * The layout primitives as variables, a collection fragment each, for `buildVariablesSpec`'s
 * collections to absorb (`mergeCollections`).
 */
export function layoutVariables(config) {
    const layout = config.layout;
    if (!layout)
        return [];
    const out = [];
    const float = (name, value) => ({
        name,
        type: 'FLOAT',
        scopes: [],
        value,
    });
    if (layout.viewport) {
        const { collection, min, max } = layout.viewport;
        const { minWidth, maxWidth } = config.utopia.viewport;
        // Only the two names are code's, not their groups, so nothing else there is reported.
        out.push({
            name: collection,
            managedGroups: [],
            variables: [float(min, minWidth), float(max, maxWidth)],
        });
    }
    if (layout.borderWidths) {
        const b = layout.borderWidths;
        const space = config.figmaVariables.space;
        const labels = new Map();
        for (const s of calculateSpaceScale(config.utopia.space).sizes) {
            labels.set(s.label.toLowerCase(), s.label.toUpperCase());
        }
        for (const label of Object.keys(space.fixed))
            labels.set(label.toLowerCase(), label);
        const variables = Object.entries(b.widths).flatMap(([width, size]) => {
            const label = labels.get(size.toLowerCase());
            if (!label) {
                throw new Error(`layout.borderWidths: ${width} is ${size}, which isn't a space size. Use one of ${[...labels.keys()].join(', ')}.`);
            }
            return [
                {
                    name: `${b.minGroup}/${width}`,
                    type: 'FLOAT',
                    scopes: [],
                    aliasOf: `${space.minGroup}/${label}`,
                    aliasCollection: space.collection,
                },
                {
                    name: `${b.maxGroup}/${width}`,
                    type: 'FLOAT',
                    scopes: [],
                    aliasOf: `${space.maxGroup}/${label}`,
                    aliasCollection: space.collection,
                },
            ];
        });
        out.push({ name: b.collection, managedGroups: [b.minGroup, b.maxGroup], variables });
    }
    if (layout.lineHeights) {
        const l = layout.lineHeights;
        const rules = config.typography.lineHeightRules ?? {};
        const steps = calculateTypeScale(config.utopia.type).map((s) => s.step);
        const scales = buildLineHeightScales(rules, steps);
        const variables = Object.entries(l.values).flatMap(([name, { rule, step }]) => {
            const scale = scales[rule];
            if (!scale) {
                throw new Error(`layout.lineHeights: ${name} uses the rule ${rule}, which typography.lineHeightRules doesn't have`);
            }
            const ratio = scale[step];
            if (ratio === undefined) {
                throw new Error(`layout.lineHeights: ${name} uses step ${step}, which isn't a type step`);
            }
            return [float(`${l.minGroup}/${name}`, ratio), float(`${l.maxGroup}/${name}`, ratio)];
        });
        out.push({ name: l.collection, managedGroups: [l.minGroup, l.maxGroup], variables });
    }
    for (const s of layout.sizes ?? []) {
        out.push({
            name: s.collection,
            managedGroups: [s.group],
            variables: Object.entries(s.values).map(([name, px]) => float(`${s.group}/${name}`, px)),
        });
    }
    return out;
}
/** The CSS name of a size: `hero-size` and `XLarge` → `hero-size-xlarge`. */
export const sizeCssName = (prefix, name) => [kebab(prefix), kebab(name)].filter(Boolean).join('-');
