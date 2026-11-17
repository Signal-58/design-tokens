# @signal58/design-tokens

Design tokens that start in code and land in Figma:

- **Palettes in OKLCH** from one brand colour per scale. Each step's lightness is solved to hit a contrast on white, so a step means the same contrast in every hue. APCA floors are checked for dark mode, and every colour is fitted to Display P3 or sRGB.
- **Fluid type and space** from Utopia settings, with the same maths as [utopia.fyi](https://utopia.fyi) (`utopia-core`).
- **Type rules**: letter spacing and line height worked out for every type step, and typography roles that become Figma text style groups.
- **Breakpoints** (optional) and a `_fluid.scss` helper for one-off fluid values, on the same viewport as the scales.
- **A Figma plugin**, built for each project from its own configs, that writes the primitives, the fluid tokens that alias them, scopes, code syntax and text styles into the project's file. It dry-runs first and never deletes.

## Starting a project

```bash
s58-tokens init --name="Acme" --brand="#E50E3F" --accent="#F3A512" --neutral="#8B8D92"
s58-tokens build
s58-tokens figma plugin
```

`init` writes `design-tokens/` with S58 Marketing's structure and rules and placeholder brand inputs:

- **Kept from S58 Marketing:** the contrast ladder, chroma curve and APCA floors; the letter spacing and line height rules; the Utopia settings and viewport, as a first guess to tune at kickoff; and the Figma collection, group and role names. They match the S58 starter Figma file.
- **Placeholders:** three colour scales (brand, accent and a neutral across the whole range), from the colours given or placeholder ones. Inter for every font family.
- **Left out until the project needs them:** breakpoints, `_fluid.scss` (it needs `utopia-core-scss`), the semantic colours (export them from Figma first) and a formatter. `tokens.config.ts` shows each one, commented out.

The built SCSS goes to `src/styles/tokens` (`--out=` to change it). `--file-key=` records the Figma file, `--id=` sets the plugin id (default `<name>-tokens-dev`), and `--force` overwrites existing files; without it, `init` refuses.

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
- the plugin's manifest names a different plugin from the config, or doesn't set `enablePrivatePluginApi` (the file guard needs it).

`checkTokens(config)` returns the same problems, for tests.

## The Figma plugin

Figma's REST API can't write variables or styles on a Pro plan, so the code runs inside Figma: as a development plugin, or through the Figma MCP's `use_figma` tool.

`s58-tokens figma plugin` writes `design-tokens/figma-plugin/code.js` (keep it out of Git) and, when it's missing, `manifest.json` with the plugin's name and id from the config (commit it). Import the manifest once in Figma desktop (**Plugins → Development → Import plugin from manifest…**), then rebuild and rerun as the configs change. Give each project its own plugin id, so a designer can import several projects' plugins side by side.

The Figma-side code (`src/figma/*.figma.js` and `plugin-ui.html`) is the same for every project; only the configs, inlined as JSON, differ. The plugin's report shows the package version it was built with, next to the build time.

### The file guard

The plugin and every `use_figma` script check which Figma file they're in before they read or change anything, so one project's tokens can't land in another project's file. They compare the file's key with `figma.fileKey` in `tokens.config.ts`, and refuse:

- any other file;
- every file while `figma.fileKey` is empty (`init` leaves it empty unless given `--file-key=`), so record the key, from the file's URL (`figma.com/design/<file key>/…`), before the first run.

Figma gives a plugin the file's key only when its manifest sets `"enablePrivatePluginApi": true`. `s58-tokens figma plugin` writes that, and adds it to an existing manifest. `use_figma` always has the key. If Figma doesn't give the key, the guard falls back to the file's name when the config sets `figma.fileName`, and otherwise refuses. A refused `use_figma` script throws, so nothing in the run is kept.

## Installing

Until it's on npm, install it from a release tag of this repository:

```json
{
  "devDependencies": {
    "@signal58/design-tokens": "github:Signal-58/design-tokens#v0.1.0"
  }
}
```

Each release tag is a commit with the built package in `dist/`, so nothing is built at install time and pnpm needs no `allowBuilds` entry for it. The lockfile pins the tag's commit, and Renovate can update the tag.

## Developing

```bash
pnpm install
pnpm test          # palette maths, the Figma modules against a stand-in for the Plugin API, init → build → check
pnpm check         # types, lint, format
pnpm build         # dist/
pnpm check:package # packs the package and runs publint and attw on the tarball
```

The tests run the code that runs inside Figma against a stand-in for the parts of the Plugin API it uses, which behaves like Figma's cloud runner: it can load only Inter.

## Releases

1. Set `version` in `package.json` and add the version to `CHANGELOG.md`, on `main`.
2. Run the **Release** workflow (Actions → Release → Run workflow) with that version.

The workflow runs CI, builds the package, and tags a commit that holds the build: `package.json` points at `dist/`, and the build scripts that would run at install are removed. `main` keeps only the source.
