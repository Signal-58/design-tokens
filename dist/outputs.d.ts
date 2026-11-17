import type { TokensConfig } from './config.js';
export interface OutputFile {
    /** From the project root. */
    destination: string;
    output: string;
}
/**
 * Runs the project's format command on one file's contents, as if they were at `file`. The command
 * is looked up in the project's node_modules/.bin first, so it works outside package scripts too.
 */
export declare function formatOutput(config: TokensConfig, file: string, contents: string, root?: string): string;
/** The generated DTCG files, as `s58-tokens generate` writes them. */
export declare function dtcgFiles(config: TokensConfig): OutputFile[];
/** Every built file except the DTCG ones, formatted. */
export declare function builtFiles(config: TokensConfig, root?: string): Promise<OutputFile[]>;
