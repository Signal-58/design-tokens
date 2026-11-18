/**
 * Type rules: letter spacing and line height worked out for every Utopia type step, and the
 * typography roles that become Figma text style groups. A project's typography config
 * (defineTypography) holds the values.
 */
/**
 * A value bound to a variable in the size collection (`Fluid tokens`) instead of written as a
 * number. `{step}` in the name is replaced by the style's step, so `Font size/Step {step}` binds
 * `Heading/Step 6` to `Font size/Step 6`. With `maxStep`, steps above it use `maxStep` instead.
 * Figma reads a bound line height, letter spacing or paragraph spacing as px.
 */
export interface VariableValue {
    variable: string;
    maxStep?: number;
}
/** A plain value for each step, such as a line height worked out by a rule. */
export interface StepValues {
    byStep: Readonly<Record<number, number>>;
}
/** Values a single step can set differently from the rest of its role. */
export interface StepOverride<Weight extends string = string> {
    weight?: Weight;
    lineHeight?: number | 'auto' | VariableValue | StepValues;
    letterSpacing?: number | VariableValue;
    paragraphSpacing?: number | VariableValue;
}
export interface TypographyRole<Family extends string = string, Weight extends string = string> {
    /** Figma style group, so styles are named `<figmaGroup>/Step <n>`. */
    figmaGroup: string;
    /** What the role is for, written into each style's description. */
    purpose: string;
    family: Family;
    weight: Weight;
    /** Utopia type steps, one style per step. */
    steps: readonly number[];
    /** Line height as a percentage of the font size, 'auto', a variable, or a value per step. */
    lineHeight: number | 'auto' | VariableValue | StepValues;
    /** Letter spacing as a percentage of the font size (-3.15 is -0.0315em), or a variable. */
    letterSpacing: number | VariableValue;
    /** Space between paragraphs in the same text box, in px, or a variable. */
    paragraphSpacing: number | VariableValue;
    /** Steps that differ from the rest of the role. */
    overrides?: Readonly<Record<number, StepOverride<Weight>>>;
    /** The HTML element code renders at a step, noted in the style description. */
    elements?: Readonly<Record<number, string>>;
}
/** The Figma collections and variable groups the text styles module reads and writes. */
export interface TypographyFigma {
    fontCollection: string;
    fontFamilyGroup: string;
    fontWeightGroup: string;
    sizeCollection: string;
    fontSizeGroup: string;
}
/**
 * The values of the font family and weight variables. Keys are the variable names after the group,
 * values the exact Figma font names. Weight values are Figma style names, which differ between
 * families ("Medium", "Book", "UltraLight").
 */
export interface TypographyFonts {
    families: Readonly<Record<string, string>>;
    weights: Readonly<Record<string, string>>;
}
/**
 * How a value changes across the Utopia type steps: letter spacing (in em) and line height (as a
 * ratio). Each step gets `base + perStep × step`, kept between `tightest` and `loosest`, unless
 * `overrides` sets it by hand. Larger text usually wants tighter spacing, so a negative `perStep`
 * tightens the steps above 0 and loosens the ones below.
 */
export interface StepRule {
    /** The value at step 0. */
    base: number;
    /** Added for each step above 0 (and taken away for each step below). */
    perStep: number;
    /** The smallest value the rule produces. Overrides can go past it. */
    tightest: number;
    /** The largest value the rule produces. Overrides can go past it. */
    loosest: number;
    /** Steps set by hand instead of by the rule. */
    overrides?: Readonly<Record<number, number>>;
}
export type LetterSpacingRule = StepRule;
/** Every whole step from `from` to `to`. */
export declare const stepsFrom: (from: number, to: number) => number[];
/** Every step of a Utopia type scale, smallest first. */
export declare const typeStepsOf: (type: {
    negativeSteps: number;
    positiveSteps: number;
}) => number[];
/** A rule worked out for each step, rounded to 4 decimal places. Unknown override steps throw. */
export declare function buildStepScale(rule: StepRule, steps: readonly number[], name?: string): Record<number, number>;
export declare const buildLetterSpacingScale: (rule: StepRule, steps: readonly number[]) => Record<number, number>;
/** Each line height rule worked out for every step, as a ratio. */
export declare function buildLineHeightScales<Kind extends string>(rules: Readonly<Record<Kind, StepRule>>, steps: readonly number[]): Record<Kind, Readonly<Record<number, number>>>;
/** A line height scale (ratios) as a Figma text style % per step. */
export declare const lineHeightPercentByStep: (scale: Readonly<Record<number, number>>) => StepValues;
/** Everything the text styles module and the letter spacing primitives need. */
export interface TypographyConfig {
    figma: TypographyFigma;
    fonts: TypographyFonts;
    /** Letter spacing for every type step, in em (buildLetterSpacingScale). */
    letterSpacingScale: Readonly<Record<number, number>>;
    /** Line height rules, one per kind of text, written as `--line-height-<kind>-<step>`. */
    lineHeightRules?: Readonly<Record<string, StepRule>>;
    roles: Readonly<Record<string, TypographyRole>>;
}
/** Checks the roles against the fonts and returns the config. */
export declare function defineTypography<const T extends TypographyConfig>(config: T): T;
