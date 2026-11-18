/**
 * @signal58/design-tokens: design tokens from code. A project keeps its configs in design-tokens/
 * and runs the s58-tokens command; this is the API those configs and any project scripts use.
 */
export { colourScopesSpecFor, DEFAULT_CONFIG_PATH, defineTokens, fileGuardFor, loadTokensConfig, textStylesSpecFor, variablesSpecFor, } from './config.js';
export * from './palette/types.js';
export * from './palette/colour.js';
export { apcaFailures, generateScale, nearestStep } from './palette/scale.js';
export { alphaName, buildPalette, resolveScales } from './palette/palette.js';
export { paletteReport } from './palette/report.js';
export * from './type/rules.js';
export * from './fluid/utopia.js';
export * from './responsive/breakpoints.js';
export { buildFigmaPlugin, packageVersion } from './figma/plugin.js';
export * from './figma/colour-scopes.js';
export { VARIABLE_SCOPES } from './figma/scopes.js';
export { checkKeys } from './keys.js';
export { fileKeyFrom, isFileKey } from './figma/file-key.js';
export { figmaScript, inlineFigmaFunction } from './figma/inline.js';
export { buildTextStyleSpec, buildTextStylesScript, resolveValue, stepStyleName, } from './figma/text-styles.js';
export * from './figma/variables.js';
export { buildTokenFiles, tokenTree, } from './style-dictionary/index.js';
export * from './style-dictionary/formats.js';
export * from './dtcg/generate.js';
export { figmaColourTokens, figmaFluidTokens, mergeTrees } from './dtcg/figma.js';
export { builtFiles, dtcgFiles, formatOutput } from './outputs.js';
export { checkTokens } from './check.js';
export { generatedApcaFailures } from './palette/report.js';
export { initProject, PLACEHOLDER_COLOURS, slugOf, starterFiles } from './init/index.js';
export { pluginManifest } from './figma/manifest.js';
