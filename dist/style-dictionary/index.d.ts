import type { TokensConfig } from '../config.js';
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
export interface BuildConfig {
    /** Figma's exports of the semantics Figma owns, from the project root. */
    semantics?: {
        /** The colour export for each mode: `{ light: '…/light.tokens.json', dark: '…' }`. */
        colours?: Readonly<Record<string, string>>;
        /** The Fluid tokens export (one mode) and its semantic groups, in output order. */
        fluid?: {
            file: string;
            groups: readonly string[];
        };
    };
    files: readonly BuildFile[];
    formats?: Readonly<Record<string, ProjectFormat>>;
}
/** The whole token tree the build reads: generated primitives plus Figma's semantics. */
export declare function tokenTree(config: TokensConfig, root?: string): DtcgTree;
/** Every file in `build.files`, formatted, without writing anything. */
export declare function buildTokenFiles(config: TokensConfig, root?: string): Promise<{
    destination: string;
    output: string;
}[]>;
