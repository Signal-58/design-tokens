# @signal58/design-tokens

Design tokens that start in code and land in Figma:

- **Palettes in OKLCH** from one brand colour per scale. Each step's lightness is solved to hit a contrast on white, so a step means the same contrast in every hue. APCA floors are checked for dark mode, and every colour is fitted to Display P3 or sRGB.
- **Fluid type and space** from Utopia settings, with the same maths as [utopia.fyi](https://utopia.fyi) (`utopia-core`).
- **Type rules**: letter spacing and line height worked out for every type step, and typography roles that become Figma text style groups.
- **Breakpoints** (optional) and a `_fluid.scss` helper for one-off fluid values, on the same viewport as the scales.
- **A Figma plugin**, built for each project from its own configs, that writes the primitives, the fluid tokens that alias them, scopes, code syntax and text styles into the project's file. It dry-runs first and never deletes.

## A project's configs

A project keeps its configs in `design-tokens/`, each wrapped in a helper that checks it:

| File                        | Helper                 | Holds                                                                                                                                                           |
| --------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `palette.config.ts`         | `definePalette`        | The scales (one brand colour each, or every step), fixed colours, alpha scales, gamut, where the palette goes in Figma. Rules default to `defaultPaletteRules`. |
| `utopia.config.ts`          | `defineUtopia`         | The viewport and the Utopia type and space settings                                                                                                             |
| `typography.config.ts`      | `defineTypography`     | Fonts, the letter spacing and line height rules, the roles                                                                                                      |
| `figma-variables.config.ts` | `defineFigmaVariables` | The Figma collections and groups the variables go in                                                                                                            |
| `tokens.config.ts`          | `defineTokens`         | Imports the four above and adds the Figma file key, the plugin's name and id, breakpoints and where the generated files go                                      |

The command reads `design-tokens/tokens.config.ts`'s default export. The configs stay TypeScript: the command loads them with [jiti](https://github.com/unjs/jiti), so nothing has to be built first.

## The command

Run it from the project root, usually through the project's `package.json` scripts:

```bash
s58-tokens generate                 # the DTCG files in design-tokens/generated
s58-tokens build                    # generate, then every file in build.files, breakpoints and _fluid.scss
s58-tokens check                    # read only, for CI: exits 1 when something's wrong
s58-tokens palette report           # contrast on white and black, APCA floors, gamut fit
s58-tokens figma plugin [--watch]   # <plugin dir>/code.js, all modules
s58-tokens figma script variables --dry-run --collections=Primitives   # for the Figma MCP's use_figma
s58-tokens figma script text-styles --dry-run --roles=heading,default
```

`--config=<file>` reads another config.

## The build

`s58-tokens build` writes the primitives as DTCG files (format 2025.10) to `design-tokens/generated/`: `palette.tokens.json` and `fluid.tokens.json`. Commit them; other tools and platforms can read them. It then reads them, plus the Figma exports listed in `build.semantics`, through [Style Dictionary](https://styledictionary.com) 5 and writes each file in `build.files`:

- **Names** come from each token's Figma code syntax (`com.figma.codeSyntax.WEB`). The generated tokens carry the same code syntax the plugin writes into Figma, and a semantic token without code syntax doesn't reach code.
- **Figma's colour exports** go in under `color.<mode>`, and each alias to `primitive/colors/…` becomes a reference to the generated palette. Figma's own resolved values are dropped: in a Display P3 file they're P3 numbers labelled `srgb`.
- **Formats** in the package: `s58/scss/colour-primitives`, `s58/scss/semantic-colours`, `s58/scss/font-size-primitives`, `s58/scss/space-primitives`, `s58/scss/letter-spacing-primitives`, `s58/scss/line-height-primitives`, `s58/scss/line-height-utilities` and `s58/scss/fluid-semantics`. Each reads the whole dictionary and picks its tokens by path. A project adds its own under `build.formats`, using the helpers the package exports (`semanticColourEntries`, `fluidEntries`, `fontSizeEntries`).

Each built file goes through the project's formatter as it's written, when the config names one (`format: { command: ['oxfmt', '--stdin-filepath={file}'] }`), so the build writes what the repository keeps. `builtFiles(config)` returns the same files without writing them, for tests.

## The check

`s58-tokens check` is read only, for CI. It fails when:

- a generated file doesn't match the configs and Figma exports: a config changed or Figma was re-exported without a rebuild, or someone edited a generated file;
- a semantic token with code syntax has a raw value instead of a reference (semantics point only at primitives or at other semantics);
- a generated scale misses an APCA floor that `check.allowApcaMisses` doesn't accept (`'amber 6 on white'`);
- the plugin's manifest names a different plugin from the config.

`checkTokens(config)` returns the same problems, for tests.

## The Figma plugin

Figma's REST API can't write variables or styles on a Pro plan, so the code runs inside Figma: as a development plugin, or through the Figma MCP's `use_figma` tool.

`s58-tokens figma plugin` writes `design-tokens/figma-plugin/code.js` (keep it out of Git) and, when it's missing, `manifest.json` with the plugin's name and id from the config (commit it). Import the manifest once in Figma desktop (**Plugins → Development → Import plugin from manifest…**), then rebuild and rerun as the configs change. Give each project its own plugin id, so a designer can import several projects' plugins side by side.

The Figma-side code (`src/figma/*.figma.js` and `plugin-ui.html`) is the same for every project; only the configs, inlined as JSON, differ.

## In this repository

The package lives in signal58-marketing's workspace until a second project needs it, then moves to its own repository (signal58-infra `docs/design-tokens-package.md`). Marketing's docs describe how its tokens use it: `docs/PALETTE.md`, `docs/TYPOGRAPHY_ROLES.md`, `docs/FIGMA_TOKENS_PLUGIN.md`, `docs/RESPONSIVE_TOKENS.md`. Its tests are in marketing's `scripts/tokens/__tests__/` for now, because they also check marketing's own configs.
