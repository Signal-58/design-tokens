# Changelog

## Unreleased

- **Export.** The plugin's new **Export** button pulls the semantics Figma owns into one file, `semantics.tokens.json`, with every collection and mode, aliases as references by name, code syntax, scopes and descriptions, and raw colours in the file's own colour profile. It leaves out what the plugin writes from code. `s58-tokens figma script export [--collections=]` gives the same code for `use_figma`.
- **The build reads the pulled file.** `build.semantics.file` names it, with the colour collection and its modes (`colours: { collection, modes }`) and the fluid collection, mode and groups (`fluid: { collection, mode, groups }`). The trees are the same as from Figma's own exports, so the built files don't change. Figma's own exports still work.
- `buildExportSpec`, `buildExportScript`, `formatExport`, `pulledColourTokens` and `pulledFluidTokens` are exported.

## 0.4.0

- **Misspelt keys are errors.** `definePalette`, `defineUtopia`, `defineTypography`, `defineFigmaVariables` and `defineTokens` reject keys their config doesn't have, all the way down, as type errors and when the config loads, naming the nearest key (`"colorScopes" isn't a setting in figmaVariables. Did you mean "colourScopes"?`). Before, a misspelt key was ignored without a word. `colourScopes` given as one rule instead of a list is an error too.
- **Typed scopes.** `VARIABLE_SCOPES` and `VariableScope` list every Figma variable scope. The palette's `figma.scopes` takes colour scopes only, typed and checked like `colourScopes`.
- **Breaking:** a config with a key the package doesn't know, or palette scopes that aren't colour scopes, no longer loads. Fix the key it names.

## 0.3.0

- **Colour scopes.** `colourScopes` in the Figma variables config sets which pickers Figma's own colour variables, such as the semantic colours, appear in, by collection and group. The most specific group wins. A new plugin module and `s58-tokens figma script colour-scopes` set only scopes, never values or names, and report rules that match nothing. The starter config shows an example.

## 0.2.0

- **File guard.** The plugin and the `use_figma` scripts refuse to run on any Figma file but the one in `figma.fileKey`, or while it's empty. Figma gives the plugin the file's key through `enablePrivatePluginApi`, which `s58-tokens figma plugin` now writes into the manifest, adding it to an existing one, and `s58-tokens check` requires. The optional `figma.fileName` is a fallback for when Figma doesn't give the key.
- While `figma.fileKey` is empty, the guard's message names the open file's key, ready to paste into the config.
- `s58-tokens init --file-key=` takes the file's link as well as its key (`fileKeyFrom`), and `defineTokens` refuses a `figma.fileKey` that isn't a bare key, saying which key to use.
- The plugin's report shows the package version it was built with.
- **Breaking:** `buildFigmaPlugin`, `buildVariablesScript`, `buildTextStylesScript` and `figmaScript` take the file guard (`fileGuardFor(config)`) as a required argument. The CLI passes it.

## 0.1.0

The first release, moved out of signal58-marketing's workspace.

- Palettes in OKLCH from one reference colour per scale, on a WCAG 2 contrast ladder with APCA floors, fitted to Display P3 or sRGB.
- Fluid type and space from Utopia settings, type rules for letter spacing and line height, breakpoints and `_fluid.scss`.
- `s58-tokens generate` and `build`: DTCG files, then every output through Style Dictionary 5, with names from Figma code syntax.
- `s58-tokens check` for CI, `s58-tokens init` for a new project's starter configs.
- A Figma plugin built per project from its configs, which works on a blank file.
