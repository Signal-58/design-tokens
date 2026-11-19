/**
 * @signal58/design-tokens: design tokens from code. A project keeps its configs in design-tokens/
 * and runs the s58-tokens command; this is the API those configs and any project scripts use.
 */
export {
  codeSyntaxSpecFor,
  colourScopesSpecFor,
  DEFAULT_CONFIG_PATH,
  defineTokens,
  fileGuardFor,
  loadTokensConfig,
  textStylesSpecFor,
  variablesSpecFor,
  type TokensConfig,
} from './config'

export * from './palette/types'
export * from './palette/colour'
export { apcaFailures, generateScale, nearestStep } from './palette/scale'
export { alphaName, buildPalette, resolveScales, type PaletteColour } from './palette/palette'
export { paletteReport } from './palette/report'

export * from './type/rules'
export * from './fluid/utopia'
export {
  defineLayout,
  layoutVariables,
  sizeCssName,
  type LayoutConfig,
  type LayoutSizes,
} from './layout/layout'
export * from './responsive/breakpoints'

export { buildFigmaPlugin, packageVersion, type PluginSpecs } from './figma/plugin'
export * from './figma/colour-scopes'
export { VARIABLE_SCOPES, type VariableScope } from './figma/scopes'
export { checkKeys, type Exactly } from './keys'
export { fileKeyFrom, isFileKey } from './figma/file-key'
export { figmaScript, inlineFigmaFunction, type FileGuard } from './figma/inline'
export {
  buildTextStyleSpec,
  buildTextStylesScript,
  resolveValue,
  stepStyleName,
  type TextStyleSpec,
} from './figma/text-styles'
export * from './figma/variables'

export {
  buildTokenFiles,
  tokenTree,
  type BuildConfig,
  type BuildFile,
  type FigmaExportSemantics,
  type ProjectFormat,
  type PulledSemantics,
} from './style-dictionary'
export * from './style-dictionary/formats'
export * from './dtcg/generate'
export {
  figmaColourTokens,
  figmaFluidTokens,
  mergeTrees,
  pulledColourTokens,
  pulledFluidTokens,
} from './dtcg/figma'
export { codeSyntaxFor, covers, isExcluded, isPulled, kebab } from './semantics/rules'
export { semanticTree, stripExcluded } from './semantics/tree'
export { semanticsScss } from './semantics/format'
export {
  buildCodeSyntaxScript,
  buildCodeSyntaxSpec,
  type CodeSyntaxSpec,
} from './figma/code-syntax'
export {
  buildExportScript,
  buildExportSpec,
  formatExport,
  type ExportSpec,
} from './figma/semantics'
export {
  applySemanticsDiff,
  buildDiffScript,
  buildDiffSpec,
  describeDiff,
  fingerprint,
  type DiffSpec,
  type DiffSummary,
  type SemanticsDiff,
  type SemanticsFingerprint,
} from './figma/diff'
export { builtFiles, dtcgFiles, formatOutput, type OutputFile } from './outputs'
export { checkTokens, type CheckResult } from './check'
export { generatedApcaFailures } from './palette/report'
export { initProject, PLACEHOLDER_COLOURS, slugOf, starterFiles, type StarterOptions } from './init'
export { pluginManifest } from './figma/manifest'
