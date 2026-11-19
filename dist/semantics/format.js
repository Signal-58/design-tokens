import { calculateClamp } from 'utopia-core';
import { CODE_SYNTAX_EXTENSION } from '../dtcg/generate.js';
import { FLUID_EXTENSION } from '../dtcg/generate.js';
import { GENERATED_HEADER } from '../responsive/breakpoints.js';
import { isPulled } from './rules.js';
import { COLLECTION_EXTENSION, MODES_EXTENSION, SCOPES_EXTENSION, UNRESOLVED_EXTENSION, } from './tree.js';
const UNITLESS = new Set(['LINE_HEIGHT', 'OPACITY', 'FONT_WEIGHT']);
const trim = (n) => String(Math.round(n * 10000) / 10000);
// Read modes from `original`: Style Dictionary resolves references inside extensions too.
const nameOf = (t) => t.$extensions?.[CODE_SYNTAX_EXTENSION]?.WEB;
const refPath = (value) => typeof value === 'string' && /^\{.+\}$/.test(value) ? value.slice(1, -1) : undefined;
export function semanticsScss({ dictionary, options, }) {
    const config = options.tokens;
    const semantics = config.build?.semantics;
    const selectors = (isPulled(semantics) ? semantics.modes : undefined) ?? {};
    const fluidModes = config.figmaVariables.fluid.modes;
    const viewport = config.utopia.viewport;
    const all = dictionary.unfilteredAllTokens ?? dictionary.allTokens;
    const byPath = new Map(all.map((t) => [t.path.join('.'), t]));
    const collectionOf = (t) => t.path[0] === 'semantic' ? t.path[1] : t.path[0] === 'fluid' ? 'fluid' : undefined;
    const infoOf = (t) => t.$extensions?.[COLLECTION_EXTENSION];
    const isFluid = (info) => !!info &&
        info.modes.length === 2 &&
        info.modes.includes(fluidModes.min) &&
        info.modes.includes(fluidModes.max);
    /** What a token's value is in `mode` (a mode of its own collection, or of whatever references it). */
    function resolve(token, mode, start, seen = new Set()) {
        const where = token.path.join('.');
        if (seen.has(where))
            throw new Error(`Circular reference at ${where}`);
        seen.add(where);
        const name = nameOf(token);
        if (!start && name)
            return { kind: 'var', name };
        const unresolved = token.$extensions?.[UNRESOLVED_EXTENSION];
        if (unresolved) {
            throw new Error(`${where} references {${String(unresolved)}}, which isn't in the pulled file or the configs, and an included token resolves through it. Fix the alias in Figma, or exclude what uses it.`);
        }
        const fluid = token.$extensions?.[FLUID_EXTENSION];
        if (fluid)
            return fluid.min === fluid.max
                ? { kind: 'size', px: fluid.min }
                : { kind: 'fluid', min: fluid.min, max: fluid.max };
        const modes = token.original.$extensions?.[MODES_EXTENSION];
        const info = token.path[0] === 'semantic' ? infoOf(token) : undefined;
        let value = token.original.$value;
        if (modes && info) {
            if (mode && mode in modes)
                value = modes[mode];
            else if (isFluid(info)) {
                // Reached from outside the collection: both viewports at once.
                const min = resolveValue(modes[fluidModes.min], token, fluidModes.min, seen);
                const max = resolveValue(modes[fluidModes.max], token, fluidModes.max, seen);
                return combine(min, max, where);
            }
            else
                value = info.defaultMode in modes ? modes[info.defaultMode] : Object.values(modes)[0];
        }
        return resolveValue(value, token, mode, seen);
    }
    function resolveValue(value, from, mode, seen) {
        const ref = refPath(value);
        if (ref) {
            const target = byPath.get(ref);
            if (!target)
                throw new Error(`${from.path.join('.')} references ${ref}, which doesn't exist`);
            return resolve(target, mode, false, new Set(seen));
        }
        if (typeof value === 'number')
            return { kind: 'size', px: value };
        throw new Error(`${from.path.join('.')} has a value the semantics format can't write: ${JSON.stringify(value)}`);
    }
    function combine(min, max, where) {
        if (min.kind === 'var' && max.kind === 'var' && min.name === max.name)
            return min;
        const px = (r, end) => r.kind === 'size' ? r.px : r.kind === 'fluid' ? r[end] : undefined;
        const a = px(min, 'min');
        const b = px(max, 'max');
        if (a === undefined || b === undefined) {
            throw new Error(`${where}: its ${fluidModes.min} and ${fluidModes.max} values point at different named tokens (${JSON.stringify(min)}, ${JSON.stringify(max)}), which the semantics format can't combine.`);
        }
        return a === b ? { kind: 'size', px: a } : { kind: 'fluid', min: a, max: b };
    }
    function css(r, token) {
        const scopes = token.$extensions?.[SCOPES_EXTENSION] ?? [];
        const unitless = scopes.length > 0 && scopes.every((s) => UNITLESS.has(s));
        if (r.kind === 'var')
            return `var(--${r.name})`;
        if (r.kind === 'size')
            return unitless ? trim(r.px) : r.px === 0 ? '0' : `${trim(r.px / 16)}rem`;
        if (unitless)
            throw new Error(`${token.path.join('.')} is unitless but fluid, which CSS can't clamp`);
        return calculateClamp({
            minSize: r.min,
            maxSize: r.max,
            minWidth: viewport.minWidth,
            maxWidth: viewport.maxWidth,
            relativeTo: viewport.relativeTo,
        });
    }
    // Blocks by selector, in order; each holds its lines, under a comment per collection and group.
    const blocks = new Map();
    const headings = new Map();
    const add = (selector, heading, line) => {
        const lines = blocks.get(selector) ?? [];
        if (headings.get(selector) !== heading) {
            if (lines.length)
                lines.push('');
            lines.push(`  /* ${heading} */`);
            headings.set(selector, heading);
        }
        lines.push(line);
        blocks.set(selector, lines);
    };
    blocks.set(':root', []);
    const moded = new Map();
    for (const token of dictionary.allTokens) {
        if (token.path[0] !== 'semantic')
            continue;
        const name = nameOf(token);
        if (!name)
            continue;
        const collection = collectionOf(token);
        const info = infoOf(token);
        const heading = `${collection}: ${token.path[2]}`;
        const modes = token.original.$extensions?.[MODES_EXTENSION];
        if (!info || isFluid(info) || info.modes.length < 2) {
            const value = isFluid(info)
                ? combine(resolveValue(modes[fluidModes.min], token, fluidModes.min, new Set()), resolveValue(modes[fluidModes.max], token, fluidModes.max, new Set()), token.path.join('.'))
                : resolve(token, info?.defaultMode, true);
            add(':root', heading, `  --${name}: ${css(value, token)};`);
            continue;
        }
        const entry = { token, name, heading, css: {}, refs: new Set() };
        for (const mode of info.modes) {
            const value = resolve(token, mode, true);
            entry.css[mode] = css(value, token);
            if (value.kind === 'var')
                entry.refs.add(value.name);
        }
        const group = moded.get(collection) ?? { info, tokens: [] };
        group.tokens.push(entry);
        moded.set(collection, group);
        add(':root', heading, `  --${name}: ${entry.css[info.defaultMode]};`);
    }
    for (const [collection, { info, tokens }] of moded) {
        for (const mode of info.modes) {
            if (mode === info.defaultMode)
                continue;
            // What the mode changes, plus whatever refers to that within the collection: a custom
            // property is computed where it's declared, so a var() of a changed one must be redeclared.
            const changed = new Set(tokens.filter((t) => t.css[mode] !== t.css[info.defaultMode]).map((t) => t.name));
            for (let grew = true; grew;) {
                grew = false;
                for (const t of tokens) {
                    if (!changed.has(t.name) && [...t.refs].some((r) => changed.has(r))) {
                        changed.add(t.name);
                        grew = true;
                    }
                }
            }
            if (!changed.size)
                continue;
            const selector = selectors[collection]?.[mode];
            if (!selector) {
                throw new Error(`${collection}'s ${mode} mode changes ${[...changed].join(', ')}, but has no selector. Add it to build.semantics.modes, or exclude what it changes.`);
            }
            for (const t of tokens) {
                if (changed.has(t.name))
                    add(selector, `${t.heading} (${mode})`, `  --${t.name}: ${t.css[mode]};`);
            }
        }
    }
    const out = [GENERATED_HEADER];
    for (const [selector, lines] of blocks) {
        if (!lines.length)
            continue;
        out.push('', `${selector} {`, ...lines, '}');
    }
    return `${out.join('\n')}\n`;
}
