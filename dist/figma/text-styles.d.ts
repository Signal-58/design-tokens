/**
 * The text styles module: turns a typography config (defineTypography) into a spec that
 * apply-text-styles.figma.js applies inside Figma.
 */
import type { StepValues, TypographyFigma, TypographyFonts, TypographyRole, VariableValue } from '../type/rules.js';
export interface TextStyleSpec {
    figma: {
        fontCollection: string;
        sizeCollection: string;
    };
    groups: string[];
    /** `kind` sets the scope of a variable the module creates: font family or font style. */
    fontVariables: {
        variable: string;
        value: string;
        kind: 'family' | 'weight';
    }[];
    styles: {
        name: string;
        description: string;
        familyVariable: string;
        weightVariable: string;
        sizeVariable: string;
        /** Plain values, or `{ variable }`: the name of a variable in the size collection. */
        lineHeight: number | 'auto' | {
            variable: string;
        };
        letterSpacing: number | {
            variable: string;
        };
        paragraphSpacing: number | {
            variable: string;
        };
    }[];
}
/**
 * Turns `Font size/Step {step}` into the variable name for one step, and a value per step
 * (`{ byStep }`) into that step's value.
 */
export declare function resolveValue<T extends number | string>(value: T | VariableValue | StepValues, step: number): T | number | {
    variable: string;
};
export declare function stepStyleName(group: string, step: number): string;
export declare function buildTextStyleSpec(roles: Readonly<Record<string, TypographyRole>>, fonts: TypographyFonts, figma: TypographyFigma): TextStyleSpec;
/** The use_figma script for text styles. */
export declare function buildTextStylesScript(spec: TextStyleSpec, dryRun: boolean): string;
