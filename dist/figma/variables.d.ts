import type { UtopiaSpaceConfig, UtopiaTypeConfig } from 'utopia-core';
import type { PaletteColour } from '../palette/palette.js';
import type { PaletteFigma } from '../palette/types.js';
import { type ColourScopeRule } from './colour-scopes.js';
import { type FileGuard } from './inline.js';
/** Which Figma variables code writes, and where they live. Variables are matched by name. */
export interface FigmaVariablesConfig {
    /** Font size primitives, one variable per Utopia type step in each group. */
    type: {
        collection: string;
        minGroup: string;
        maxGroup: string;
    };
    /** Letter spacing primitives in px, one per type step. Must share the type collection. */
    letterSpacing: {
        collection: string;
        minGroup: string;
        maxGroup: string;
    };
    /** Space primitives, one per Utopia space size in each group, plus fixed sizes at both viewports. */
    space: {
        collection: string;
        minGroup: string;
        maxGroup: string;
        fixed: Readonly<Record<string, number>>;
    };
    /**
     * The fluid tokens designers bind to: each aliases the @min primitive in the Min mode and the
     * @max one in the Max mode, with scopes, code syntax (the CSS variable) and a description.
     */
    fluid: {
        collection: string;
        modes: {
            min: string;
            max: string;
        };
        fontSizeGroup: string;
        letterSpacingGroup: string;
        spaceGroup: string;
        /** Utopia's one-up pairs (S—M); Min is the first size, Max the second. */
        pairsGroup: string;
        /** Utopia's custom pairs, from the space config's customSizes. */
        customPairsGroup: string;
        /** Named pairs for hand-written CSS variables: name → Utopia pair and code syntax. */
        namedPairs: Readonly<Record<string, {
            pair: string;
            codeSyntax: string;
        }>>;
    };
    /**
     * Optional: the scopes of colour variables Figma owns, such as the semantic colours, by
     * collection and group. The plugin sets only their scopes (colour-scopes.ts).
     */
    colourScopes?: readonly ColourScopeRule[];
}
/** Checks the config and returns it. */
export declare function defineFigmaVariables<const T extends FigmaVariablesConfig>(config: T): T;
export type VariableType = 'FLOAT' | 'STRING' | 'BOOLEAN' | 'COLOR';
export interface FigmaColour {
    r: number;
    g: number;
    b: number;
    a: number;
}
export type PlainValue = number | string | boolean | FigmaColour;
/** A value for one mode: plain, or an alias to a variable in `collection` (default: the same one). */
export type ModeValue = PlainValue | {
    aliasOf: string;
    collection?: string;
};
interface EntryMeta {
    name: string;
    type: VariableType;
    /** Written when given; a new variable without them gets none, as primitives have. */
    scopes?: string[];
    /** The WEB code syntax, the CSS variable without `--`. */
    codeSyntax?: string;
    description?: string;
}
/**
 * A plain value or (`aliasOf`) an alias to another variable in the same collection, both in the
 * default mode; or (`modes`) a value for each named mode.
 */
export type VariableEntry = EntryMeta & ({
    value: PlainValue;
} | {
    aliasOf: string;
} | {
    modes: Record<string, ModeValue>;
});
export interface VariablesSpec {
    /** Colour values are only written when the file's documentColorProfile is this. */
    colorProfile?: string;
    collections: {
        name: string;
        /** The collection's modes, created when missing. Without them, only the default mode is written. */
        modes?: string[];
        /** Stop instead of creating the collection when it's missing. */
        required?: boolean;
        /** Groups whose variables all come from code: any other variable in them is reported. */
        managedGroups: string[];
        variables: VariableEntry[];
    }[];
}
/** The palette as colour variables: values in the file's colour profile, refs as aliases. */
export declare function paletteVariables(palette: PaletteColour[], where: PaletteFigma): VariablesSpec['collections'][number];
type TypeConfig = UtopiaTypeConfig;
type SpaceConfig = UtopiaSpaceConfig;
/** A description for a fluid value: px at the two viewports, to 2 decimal places. */
export declare function fluidDescription(min: number, max: number, minWidth: number, maxWidth: number): string;
/** Letter spacing in px for a font size: em times size, to 3 decimal places. */
export declare function letterSpacingPx(em: number, fontSize: number): number;
export declare function buildVariablesSpec(type: TypeConfig, space: SpaceConfig, where: FigmaVariablesConfig, letterSpacing: Readonly<Record<number, number>>, palette?: VariablesSpec['collections'][number] | null, 
/** The file colour profile the palette's values are for (the palette's `figma.colorProfile`). */
colorProfile?: string): VariablesSpec;
/** The use_figma script for variables. */
export declare function buildVariablesScript(spec: VariablesSpec, dryRun: boolean, guard: FileGuard): string;
export {};
