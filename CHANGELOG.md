# Changelog

## 0.6.1

- **Mode blocks hold only what a mode changes.** In `s58/scss/semantics`, a collection with other modes has its default mode in `:root`, and each other mode's block holds only the tokens that mode changes, plus any that refer to them within the collection (a custom property is computed where it's declared). A mode that changes nothing in code writes nothing and needs no selector, so its variants can stay design only.
- `check` no longer asks for a selector for every mode; the build stops on a mode that changes something and has none, naming what it changes. The default mode is always `:root`.

## 0.6.0

- **Every semantic in code.** `build.semantics` takes `exclude` (collections and groups that stay in Figma), `codeSyntax` (names by group for what Figma hasn't named) and `modes` (a selector per mode of any other multi-mode collection). Once a project sets `exclude` or `codeSyntax`, the new `s58/scss/semantics` format writes every semantic not excluded: fluid Min/Max collections as `var()` or `clamp()`, single-mode ones in `:root`, others as a block per mode. References through excluded tokens resolve to the next named one.
- **Code syntax module.** The plugin names Figma's semantics by those rules, after a dry run, never changing a name a designer set; `s58-tokens figma script code-syntax` does the same through `use_figma`.
- **The check** fails, once a project opts in, on exclusions that match nothing, semantics neither named nor excluded, modes with no selector and no file in the semantics format. Before that it notes how many semantics don't reach code. Nothing changes for a project that doesn't opt in.

## 0.5.0

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
