/**
 * Type rules: letter spacing and line height worked out for every Utopia type step, and the
 * typography roles that become Figma text style groups. A project's typography config
 * (defineTypography) holds the values.
 */
import { checkKeys, keysOf } from '../keys.js';
/** Every whole step from `from` to `to`. */
export const stepsFrom = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
/** Every step of a Utopia type scale, smallest first. */
export const typeStepsOf = (type) => stepsFrom(-type.negativeSteps, type.positiveSteps);
/** A rule worked out for each step, rounded to 4 decimal places. Unknown override steps throw. */
export function buildStepScale(rule, steps, name = 'The rule') {
    const overrides = rule.overrides ?? {};
    const unknown = Object.keys(overrides).filter((s) => !steps.includes(Number(s)));
    if (unknown.length) {
        throw new Error(`${name} overrides steps that aren't in the type scale: ${unknown}`);
    }
    const round = (n) => Math.round(n * 10000) / 10000 || 0;
    return Object.fromEntries(steps.map((step) => {
        const fromRule = Math.min(rule.loosest, Math.max(rule.tightest, rule.base + rule.perStep * step));
        return [step, round(overrides[step] ?? fromRule)];
    }));
}
export const buildLetterSpacingScale = (rule, steps) => buildStepScale(rule, steps, 'letterSpacingRule');
/** Each line height rule worked out for every step, as a ratio. */
export function buildLineHeightScales(rules, steps) {
    return Object.fromEntries(Object.entries(rules).map(([kind, rule]) => [
        kind,
        buildStepScale(rule, steps, `lineHeightRules.${kind}`),
    ]));
}
/** A line height scale (ratios) as a Figma text style % per step. */
export const lineHeightPercentByStep = (scale) => ({
    byStep: Object.fromEntries(Object.entries(scale).map(([step, ratio]) => [step, Math.round(ratio * 10000) / 100])),
});
const TYPOGRAPHY_KEYS = keysOf()('figma', 'fonts', 'letterSpacingScale', 'lineHeightRules', 'roles');
const TYPOGRAPHY_FIGMA_KEYS = keysOf()('fontCollection', 'fontFamilyGroup', 'fontWeightGroup', 'sizeCollection', 'fontSizeGroup');
const FONTS_KEYS = keysOf()('families', 'weights');
const ROLE_KEYS = keysOf()('figmaGroup', 'purpose', 'family', 'weight', 'steps', 'lineHeight', 'letterSpacing', 'paragraphSpacing', 'overrides', 'elements');
const STEP_RULE_KEYS = keysOf()('base', 'perStep', 'tightest', 'loosest', 'overrides');
/**
 * Checks the roles against the fonts, and that nothing has unknown or misspelt keys, and returns
 * the config.
 */
export function defineTypography(config) {
    checkKeys('typography', config, TYPOGRAPHY_KEYS);
    checkKeys('typography.figma', config.figma, TYPOGRAPHY_FIGMA_KEYS);
    checkKeys('typography.fonts', config.fonts, FONTS_KEYS);
    for (const [kind, rule] of Object.entries(config.lineHeightRules ?? {})) {
        checkKeys(`typography.lineHeightRules.${kind}`, rule, STEP_RULE_KEYS);
    }
    for (const [key, role] of Object.entries(config.roles)) {
        checkKeys(`typography.roles.${key}`, role, ROLE_KEYS);
        if (!(role.family in config.fonts.families)) {
            throw new Error(`Typography role ${key} uses the font family ${role.family}, which isn't in fonts.families`);
        }
        const weights = [role.weight, ...Object.values(role.overrides ?? {}).map((o) => o.weight)];
        for (const weight of weights) {
            if (weight !== undefined && !(weight in config.fonts.weights)) {
                throw new Error(`Typography role ${key} uses the font weight ${weight}, which isn't in fonts.weights`);
            }
        }
    }
    return config;
}
