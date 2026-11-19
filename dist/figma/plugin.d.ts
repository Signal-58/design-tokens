import type { CodeSyntaxSpec } from './code-syntax.js';
import type { ColourScopesSpec } from './colour-scopes.js';
import type { ExportSpec } from './semantics.js';
import { type FileGuard } from './inline.js';
import type { TextStyleSpec } from './text-styles.js';
import type { VariablesSpec } from './variables.js';
export interface PluginSpecs {
    variables?: VariablesSpec;
    colourScopes?: ColourScopesSpec;
    /** Names Figma's semantics that have no code syntax, by the project's rules. */
    codeSyntax?: CodeSyntaxSpec;
    textStyles?: TextStyleSpec;
    /** The Export button: what to leave out (the variables the plugin writes). */
    export?: ExportSpec;
}
/** This package's version, from its package.json (two folders up from src/figma and dist/figma). */
export declare function packageVersion(): string;
export declare function buildFigmaPlugin(specs: PluginSpecs, guard: FileGuard, builtAt?: Date): string;
