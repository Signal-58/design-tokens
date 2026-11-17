import type { TextStyleSpec } from './text-styles.js';
import type { VariablesSpec } from './variables.js';
export interface PluginSpecs {
    variables?: VariablesSpec;
    textStyles?: TextStyleSpec;
}
export declare function buildFigmaPlugin(specs: PluginSpecs, builtAt?: Date): string;
