import type { ColourScopesSpec } from './colour-scopes.js';
import { type FileGuard } from './inline.js';
import type { TextStyleSpec } from './text-styles.js';
import type { VariablesSpec } from './variables.js';
export interface PluginSpecs {
    variables?: VariablesSpec;
    colourScopes?: ColourScopesSpec;
    textStyles?: TextStyleSpec;
}
/** This package's version, from its package.json (two folders up from src/figma and dist/figma). */
export declare function packageVersion(): string;
export declare function buildFigmaPlugin(specs: PluginSpecs, guard: FileGuard, builtAt?: Date): string;
