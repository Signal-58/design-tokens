import { type TokensConfig } from '../config.js';
import { isPulled } from '../semantics/rules.js';
import { type DtcgTree } from '../dtcg/generate.js';
import { type FormatArgs } from './formats.js';
export interface BuildFile {
    /** From the project root. */
    destination: string;
    /** A package format (`s58/scss/colour-primitives`) or one of the project's `build.formats`. */
    format: string;
    options?: Record<string, unknown>;
}
export type ProjectFormat = (args: FormatArgs) => string | Promise<string>;
/**
 * The semantics Figma owns, from the pulled file: what the plugin's Export button, or
 * `s58-tokens figma script export`, writes.
 */
export interface PulledSemantics {
    /** The pulled file, from the project root: by convention `design-tokens/figma/semantics.tokens.json`. */
    file: string;
    /** The colour collection, and the Figma mode each output mode reads: `{ light: 'Light', dark: 'Dark' }`. */
    colours?: {
        collection: string;
        modes: Readonly<Record<string, string>>;
    };
    /** The fluid collection, the mode to read (the semantics alias the same sizes in both) and its semantic groups, in output order. */
    fluid?: {
        collection: string;
        mode: string;
        groups: readonly string[];
    };
    /**
     * Collections and groups that stay in Figma, by path: `Sizes`, `Fluid tokens/Layout/Hero`. They
     * get no code syntax from the plugin and no CSS; references through them still resolve.
     */
    exclude?: readonly string[];
    /**
     * Names for the semantics Figma hasn't named, by group: `{ 'Fluid tokens/Grid': 'grid' }` gives
     * `Grid/Two thirds` the code syntax `grid-two-thirds`. The plugin writes them into Figma.
     */
    codeSyntax?: Readonly<Record<string, string>>;
    /**
     * The selector for each mode of a collection with modes other than Light/Dark and Min/Max, for
     * the modes that change a named token: `{ 'Layout blocks': { Flush: "[data-block-spacing='flush']" } }`.
     * The default mode is `:root`. A mode that changes nothing in code needs none: it stays design only.
     */
    modes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
/** Figma's own variable exports, one file per mode. Superseded by the pulled file (`PulledSemantics`). */
export interface FigmaExportSemantics {
    /** The colour export for each mode: `{ light: '…/light.tokens.json', dark: '…' }`. */
    colours?: Readonly<Record<string, string>>;
    /** The Fluid tokens export (one mode) and its semantic groups, in output order. */
    fluid?: {
        file: string;
        groups: readonly string[];
    };
}
export interface BuildConfig {
    /** The semantics Figma owns: the pulled file, or Figma's own exports. Paths from the project root. */
    semantics?: PulledSemantics | FigmaExportSemantics;
    files: readonly BuildFile[];
    formats?: Readonly<Record<string, ProjectFormat>>;
}
export { isPulled };
/** The semantic groups the build reads from the fluid collection. */
export declare const fluidSemanticGroups: (semantics: BuildConfig['semantics']) => readonly string[];
/** The whole token tree the build reads: generated primitives plus Figma's semantics. */
export declare function tokenTree(config: TokensConfig, root?: string): DtcgTree;
/** Every file in `build.files`, formatted, without writing anything. */
export declare function buildTokenFiles(config: TokensConfig, root?: string): Promise<{
    destination: string;
    output: string;
}[]>;
