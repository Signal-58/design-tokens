/**
 * The primitives as DTCG token files (format 2025.10): what `s58-tokens generate` writes to
 * design-tokens/generated/ and what Style Dictionary builds the CSS from.
 *
 * - palette.tokens.json: `primitive.colors.<scale>.<step>`, OKLCH colour objects rounded the way the
 *   CSS prints them, aliases as references.
 * - fluid.tokens.json: `fluid.<group>…` named like the Figma `Fluid tokens` collection the plugin
 *   writes (`Font size/Step 0`, `Space size/S`, `Space size pairs/S—M`), with min, max and the
 *   `clamp()` in `$extensions`, plus letter spacing (em) and line height (ratio) per type step.
 * - layout.tokens.json, when the layout config builds any sizes into CSS: `layout.<group>.<name>`
 *   in px (`layout.Hero.Small`).
 *
 * Every token carries its CSS name as Figma code syntax (`com.figma.codeSyntax.WEB`), the same
 * value the plugin writes into Figma, so code and Figma name things the same way.
 */
import { calculateSpaceScale, calculateTypeScale } from 'utopia-core';
import { sizeCssName } from '../layout/layout.js';
import { buildPalette } from '../palette/palette.js';
import { buildLineHeightScales } from '../type/rules.js';
/** `$extensions` key for the fluid data: min and max in px, the viewport, the CSS `clamp()`. */
export const FLUID_EXTENSION = 'com.signal58.fluid';
/** `$extensions` key Figma uses for code syntax; WEB is the CSS name without `--`. */
export const CODE_SYNTAX_EXTENSION = 'com.figma.codeSyntax';
/** The CSS prefix of the private colour primitives: `--_primitive-color-amber-6`. */
export const COLOUR_PRIMITIVE_PREFIX = '_primitive-color-';
const css = (x) => x.replace(/_/g, '-');
const codeSyntax = (web) => ({ [CODE_SYNTAX_EXTENSION]: { WEB: web } });
const round = (x, dp) => Number(x.toFixed(dp));
/** A colour rounded the way `formatOklch` prints it, as a DTCG colour object. */
function colourValue({ l, c, h, alpha = 1 }) {
    return {
        colorSpace: 'oklch',
        components: [round(l, 4), round(c, 4), round(h, 2)],
        alpha: alpha < 1 ? round(alpha * 100, 2) / 100 : 1,
    };
}
/** Sets `tree[a][b][c] = value` for `path` `a/b/c`. */
function put(tree, path, value) {
    let node = tree;
    for (const part of path.slice(0, -1)) {
        node[part] ??= {};
        node = node[part];
    }
    node[path[path.length - 1]] = value;
}
export function paletteTokens(config) {
    const tree = {};
    for (const c of buildPalette(config.palette)) {
        const extensions = codeSyntax(`${COLOUR_PRIMITIVE_PREFIX}${css(c.group)}-${css(c.name)}`);
        put(tree, ['primitive', 'colors', c.group, c.name], c.aliasOf
            ? {
                $type: 'color',
                $value: `{primitive.colors.${c.aliasOf.group}.${c.aliasOf.name}}`,
                $extensions: extensions,
            }
            : { $type: 'color', $value: colourValue(c.colour), $extensions: extensions });
    }
    return tree;
}
export function fluidTokens(config) {
    const { utopia, figmaVariables, typography } = config;
    const f = figmaVariables.fluid;
    const at = (group, name) => ['fluid', ...group.split('/'), name];
    const tree = {};
    const fluid = (kind, label, min, max, clamp) => ({
        [FLUID_EXTENSION]: {
            kind,
            label,
            min,
            max,
            ...(clamp ? { clamp } : {}),
        },
    });
    const steps = calculateTypeScale(utopia.type).sort((a, b) => a.step - b.step);
    for (const s of steps) {
        put(tree, at(f.fontSizeGroup, `Step ${s.step}`), {
            $type: 'dimension',
            $value: { value: s.maxFontSize, unit: 'px' },
            $extensions: {
                ...codeSyntax(`font-size-${s.step}`),
                ...fluid('type', String(s.step), s.minFontSize, s.maxFontSize, s.clamp),
            },
        });
    }
    for (const s of steps) {
        const em = typography.letterSpacingScale[s.step];
        if (em === undefined)
            throw new Error(`The letter spacing scale has no value for type step ${s.step}`);
        put(tree, at(f.letterSpacingGroup, `Step ${s.step}`), {
            $type: 'dimension',
            $value: { value: em, unit: 'em' },
            $extensions: {
                ...codeSyntax(`letter-spacing-${s.step}`),
                ...fluid('type', String(s.step), em, em),
            },
        });
    }
    const space = calculateSpaceScale(utopia.space);
    const sizeName = (label) => label.toUpperCase();
    for (const s of space.sizes) {
        put(tree, at(f.spaceGroup, sizeName(s.label)), {
            $type: 'dimension',
            $value: { value: s.maxSize, unit: 'px' },
            $extensions: {
                ...codeSyntax(`space-${s.label}`),
                ...fluid('size', s.label, s.minSize, s.maxSize, s.clamp),
            },
        });
    }
    for (const [label, value] of Object.entries(figmaVariables.space.fixed)) {
        const name = label.toLowerCase() === 'zero' ? 'none' : label.toLowerCase();
        put(tree, at(f.spaceGroup, label), {
            $type: 'dimension',
            $value: { value, unit: 'px' },
            $extensions: { ...codeSyntax(`space-${name}`), ...fluid('fixed', name, value, value) },
        });
    }
    const pairName = (label) => label.split('-').map(sizeName).join('—');
    for (const [kind, group, pairs] of [
        ['one-up-pair', f.pairsGroup, space.oneUpPairs],
        ['custom-pair', f.customPairsGroup, space.customPairs],
    ]) {
        for (const p of pairs) {
            put(tree, at(group, pairName(p.label)), {
                $type: 'dimension',
                $value: { value: p.maxSize, unit: 'px' },
                $extensions: {
                    ...codeSyntax(`space-${p.label}`),
                    ...fluid(kind, p.label, p.minSize, p.maxSize, p.clamp),
                },
            });
        }
    }
    for (const [name, named] of Object.entries(f.namedPairs)) {
        const path = name.split('/');
        put(tree, ['fluid', ...path], {
            $type: 'dimension',
            $value: `{fluid.${f.pairsGroup.split('/').join('.')}.${pairName(named.pair)}}`,
            $extensions: codeSyntax(named.codeSyntax),
        });
    }
    const typeSteps = steps.map((s) => s.step);
    const lineHeights = typography.lineHeightRules
        ? buildLineHeightScales(typography.lineHeightRules, typeSteps)
        : {};
    for (const [kind, scale] of Object.entries(lineHeights)) {
        for (const step of typeSteps) {
            const ratio = scale[step];
            put(tree, ['line-height', kind, `Step ${step}`], {
                $type: 'number',
                $value: ratio,
                $extensions: {
                    ...codeSyntax(`line-height-${kind}-${step}`),
                    ...fluid('type', String(step), ratio, ratio),
                },
            });
        }
    }
    return tree;
}
/** The layout config's sizes that go into CSS, or undefined when none do. */
export function layoutTokens(config) {
    const tree = {};
    for (const sizes of config.layout?.sizes ?? []) {
        if (!sizes.css)
            continue;
        const omit = new Set(sizes.css.omit ?? []);
        for (const [name, px] of Object.entries(sizes.values)) {
            if (omit.has(name))
                continue;
            put(tree, ['layout', ...sizes.group.split('/'), name], {
                $type: 'dimension',
                $value: { value: px, unit: 'px' },
                $extensions: codeSyntax(sizeCssName(sizes.css.prefix, name)),
            });
        }
    }
    return Object.keys(tree).length ? tree : undefined;
}
/** Every generated DTCG file, by file name. */
export function generateDtcg(config) {
    const layout = layoutTokens(config);
    return {
        'palette.tokens.json': paletteTokens(config),
        'fluid.tokens.json': fluidTokens(config),
        ...(layout ? { 'layout.tokens.json': layout } : {}),
    };
}
