/**
 * @signal58/design-tokens: design tokens from code. A project keeps its configs in design-tokens/
 * and runs the s58-tokens command; this is the API those configs and any project scripts use.
 */
export { colourScopesSpecFor, DEFAULT_CONFIG_PATH, defineTokens, fileGuardFor, loadTokensConfig, textStylesSpecFor, variablesSpecFor, type TokensConfig, } from './config.js';
export * from './palette/types.js';
export * from './palette/colour.js';
export { apcaFailures, generateScale, nearestStep } from './palette/scale.js';
export { alphaName, buildPalette, resolveScales, type PaletteColour } from './palette/palette.js';
export { paletteReport } from './palette/report.js';
export * from './type/rules.js';
export * from './fluid/utopia.js';
export * from './responsive/breakpoints.js';
export { buildFigmaPlugin, packageVersion, type PluginSpecs } from './figma/plugin.js';
export * from './figma/colour-scopes.js';
export { fileKeyFrom, isFileKey } from './figma/file-key.js';
export { figmaScript, inlineFigmaFunction, type FileGuard } from './figma/inline.js';
export { buildTextStyleSpec, buildTextStylesScript, resolveValue, stepStyleName, type TextStyleSpec, } from './figma/text-styles.js';
export * from './figma/variables.js';
export { buildTokenFiles, tokenTree, type BuildConfig, type BuildFile, type ProjectFormat, } from './style-dictionary/index.js';
export * from './style-dictionary/formats.js';
export * from './dtcg/generate.js';
export { figmaColourTokens, figmaFluidTokens, mergeTrees } from './dtcg/figma.js';
export { builtFiles, dtcgFiles, formatOutput, type OutputFile } from './outputs.js';
export { checkTokens, type CheckResult } from './check.js';
export { generatedApcaFailures } from './palette/report.js';
export { initProject, PLACEHOLDER_COLOURS, slugOf, starterFiles, type StarterOptions } from './init/index.js';
export { pluginManifest } from './figma/manifest.js';
