# Changelog

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
