/**
 * @signal58/design-tokens: design tokens from code. A project keeps its configs in design-tokens/
 * and runs the s58-tokens command; this is the API those configs and any project scripts use.
 */
export { codeSyntaxSpecFor, colourScopesSpecFor, DEFAULT_CONFIG_PATH, defineTokens, fileGuardFor, loadTokensConfig, textStylesSpecFor, variablesSpecFor, type TokensConfig, } from './config.js';
export * from './palette/types.js';
export * from './palette/colour.js';
export { apcaFailures, generateScale, nearestStep } from './palette/scale.js';
export { alphaName, buildPalette, resolveScales, type PaletteColour } from './palette/palette.js';
export { paletteReport } from './palette/report.js';
export * from './type/rules.js';
export * from './fluid/utopia.js';
export { defineLayout, layoutVariables, sizeCssName, type LayoutConfig, type LayoutSizes, } from './layout/layout.js';
export * from './responsive/breakpoints.js';
export { buildFigmaPlugin, packageVersion, type PluginSpecs } from './figma/plugin.js';
export * from './figma/colour-scopes.js';
export { VARIABLE_SCOPES, type VariableScope } from './figma/scopes.js';
export { checkKeys, type Exactly } from './keys.js';
export { fileKeyFrom, isFileKey } from './figma/file-key.js';
export { figmaScript, inlineFigmaFunction, type FileGuard } from './figma/inline.js';
export { buildTextStyleSpec, buildTextStylesScript, resolveValue, stepStyleName, type TextStyleSpec, } from './figma/text-styles.js';
export * from './figma/variables.js';
export { buildTokenFiles, tokenTree, type BuildConfig, type BuildFile, type FigmaExportSemantics, type ProjectFormat, type PulledSemantics, } from './style-dictionary/index.js';
export * from './style-dictionary/formats.js';
export * from './dtcg/generate.js';
export { figmaColourTokens, figmaFluidTokens, mergeTrees, pulledColourTokens, pulledFluidTokens, } from './dtcg/figma.js';
export { codeSyntaxFor, covers, isExcluded, isPulled, kebab } from './semantics/rules.js';
export { semanticTree, stripExcluded } from './semantics/tree.js';
export { semanticsScss } from './semantics/format.js';
export { buildCodeSyntaxScript, buildCodeSyntaxSpec, type CodeSyntaxSpec, } from './figma/code-syntax.js';
export { buildExportScript, buildExportSpec, formatExport, type ExportSpec, } from './figma/semantics.js';
export { applySemanticsDiff, buildDiffScript, buildDiffSpec, describeDiff, fingerprint, type DiffSpec, type DiffSummary, type SemanticsDiff, type SemanticsFingerprint, } from './figma/diff.js';
export { builtFiles, dtcgFiles, formatOutput, type OutputFile } from './outputs.js';
export { checkTokens, type CheckResult } from './check.js';
export { generatedApcaFailures } from './palette/report.js';
export { initProject, PLACEHOLDER_COLOURS, slugOf, starterFiles, type StarterOptions } from './init/index.js';
export { pluginManifest } from './figma/manifest.js';
