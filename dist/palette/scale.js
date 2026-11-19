import { apcaContrast, contrastRatio, fitToGamut, luminance, parseColour } from './colour.js';
const white = { l: 1, c: 0, h: 0 };
const round = (x, dp) => Number(x.toFixed(dp));
/** The lightness, with chroma fitted to the gamut, whose contrast on white is `target`. */
function solveLightness(target, c, h, gamut) {
    const wantY = 1.05 / target - 0.05;
    let lo = 0;
    let hi = 1;
    let best = fitToGamut({ l: 0.5, c, h }, gamut);
    for (let i = 0; i < 40; i++) {
        const l = (lo + hi) / 2;
        best = fitToGamut({ l, c, h }, gamut);
        if (luminance(best) < wantY)
            lo = l;
        else
            hi = l;
    }
    return { ...best, l: round(best.l, 4) };
}
/** The step (1 to n) whose target contrast is nearest the colour's own, on a log scale. */
export function nearestStep(colour, targets) {
    const own = Math.log(contrastRatio(colour, white));
    let best = 0;
    targets.forEach((t, i) => {
        if (Math.abs(Math.log(t) - own) < Math.abs(Math.log(targets[best]) - own))
            best = i;
    });
    return best + 1;
}
export function generateScale(input, rules, gamut, name = 'scale') {
    const spec = typeof input === 'string' ? { colour: input } : input;
    const ref = fitToGamut(parseColour(spec.colour), gamut);
    const n = rules.contrastOnWhite.length;
    const lightness = [];
    const chroma = [];
    if (spec.range) {
        const [from, to] = spec.range;
        for (let i = 0; i < n; i++) {
            lightness.push(round(from + ((to - from) * i) / (n - 1), 4));
            chroma.push(ref.c);
        }
    }
    else {
        const r = (spec.refStep ?? nearestStep(ref, rules.contrastOnWhite)) - 1;
        if (r < 0 || r >= n)
            throw new Error(`${name}.refStep must be 1 to ${n}`);
        const { lightest, darkest } = rules.chroma;
        for (let i = 0; i < n; i++) {
            const f = i <= r
                ? lightest + (1 - lightest) * (r === 0 ? 1 : i / r)
                : 1 - (1 - darkest) * ((i - r) / (n - 1 - r));
            const step = i === r ? ref : solveLightness(rules.contrastOnWhite[i], ref.c * f, ref.h, gamut);
            lightness.push(step.l);
            chroma.push(round(step.c, 4));
        }
    }
    const refStep = spec.range
        ? lightness.reduce((b, l, i) => (Math.abs(l - ref.l) < Math.abs(lightness[b] - ref.l) ? i : b), 0) + 1
        : (spec.refStep ?? nearestStep(ref, rules.contrastOnWhite));
    if (!spec.range) {
        const contrasts = lightness.map((l, i) => contrastRatio({ l, c: chroma[i], h: ref.h }, white));
        const i = contrasts.findIndex((c, k) => k > 0 && c < contrasts[k - 1]);
        if (i > 0) {
            throw new Error(`${name}: the reference at step ${refStep} has contrast ${contrasts[refStep - 1].toFixed(2)}, ` +
                `out of order with its neighbours. Leave refStep out to place it at step ` +
                `${nearestStep(ref, rules.contrastOnWhite)}, or change the reference colour.`);
        }
    }
    for (const [step, o] of Object.entries(spec.overrides ?? {})) {
        const i = Number(step) - 1;
        if (!(i >= 0 && i < n))
            throw new Error(`${name}.overrides has step ${step}; steps are 1 to ${n}`);
        if (o.l !== undefined)
            lightness[i] = o.l;
        if (o.c !== undefined)
            chroma[i] = o.c;
    }
    return { hue: ref.h, ref: refStep, lightness, chroma };
}
const black = { l: 0, c: 0, h: 0 };
/**
 * The APCA floors in `rules.apca` a scale misses: text on black at a step and every lighter one,
 * text on white at a step and every darker one. Empty when it meets them all.
 */
export function apcaFailures(scale, rules, name = 'scale') {
    const colours = scale.lightness.map((l, i) => ({ l, c: scale.chroma[i], h: scale.hue }));
    const failures = [];
    const check = (floors, bg, label, lighter) => {
        for (const [step, floor] of Object.entries(floors ?? {})) {
            const s = Number(step);
            colours.forEach((c, i) => {
                if (lighter ? i + 1 > s : i + 1 < s)
                    return;
                const lc = Math.abs(apcaContrast(c, bg));
                if (lc < floor)
                    failures.push(`${name} ${i + 1}: Lc ${lc.toFixed(1)} ${label}, below ${floor}`);
            });
        }
    };
    check(rules.apca?.onBlack, black, 'on black', true);
    check(rules.apca?.onWhite, white, 'on white', false);
    return [...new Set(failures)];
}
