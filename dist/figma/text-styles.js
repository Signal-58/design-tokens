import { figmaScript } from './inline.js';
/**
 * Turns `Font size/Step {step}` into the variable name for one step, and a value per step
 * (`{ byStep }`) into that step's value.
 */
export function resolveValue(value, step) {
    if (typeof value !== 'object')
        return value;
    if ('byStep' in value) {
        const at = value.byStep[step];
        if (at === undefined)
            throw new Error(`No value for step ${step}`);
        return at;
    }
    const at = value.maxStep === undefined ? step : Math.min(step, value.maxStep);
    return { variable: value.variable.replace('{step}', String(at)) };
}
export function stepStyleName(group, step) {
    return `${group}/Step ${step}`;
}
function styleDescription(roleKey, role, step) {
    const element = role.elements?.[step];
    const where = element ? `, ${element} in code` : '';
    return (`${role.purpose}: step ${step}${where}. ` +
        `Generated from design-tokens/typography.config.ts (role: ${roleKey}). ` +
        'Change it there and rerun the script; edits made here are overwritten.');
}
export function buildTextStyleSpec(roles, fonts, figma) {
    const fontVariables = [
        ...Object.entries(fonts.families).map(([key, value]) => ({
            variable: `${figma.fontFamilyGroup}/${key}`,
            value,
            kind: 'family',
        })),
        ...Object.entries(fonts.weights).map(([key, value]) => ({
            variable: `${figma.fontWeightGroup}/${key}`,
            value,
            kind: 'weight',
        })),
    ];
    const styles = [];
    const names = new Set();
    for (const [roleKey, role] of Object.entries(roles)) {
        for (const step of role.steps) {
            const name = stepStyleName(role.figmaGroup, step);
            if (names.has(name))
                throw new Error(`Two roles define the text style "${name}"`);
            names.add(name);
            const at = { ...role, ...role.overrides?.[step] };
            styles.push({
                name,
                description: styleDescription(roleKey, role, step),
                familyVariable: `${figma.fontFamilyGroup}/${role.family}`,
                weightVariable: `${figma.fontWeightGroup}/${at.weight}`,
                sizeVariable: `${figma.fontSizeGroup}/Step ${step}`,
                lineHeight: resolveValue(at.lineHeight, step),
                letterSpacing: resolveValue(at.letterSpacing, step),
                paragraphSpacing: resolveValue(at.paragraphSpacing, step),
            });
        }
    }
    return {
        figma: { fontCollection: figma.fontCollection, sizeCollection: figma.sizeCollection },
        groups: [...new Set(Object.values(roles).map((r) => r.figmaGroup))],
        fontVariables,
        styles,
    };
}
/** The use_figma script for text styles. */
export function buildTextStylesScript(spec, dryRun) {
    return figmaScript('apply-text-styles.figma.js', 'applyTextStyles', spec, dryRun);
}
