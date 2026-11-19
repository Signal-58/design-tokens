# @signal58/design-tokens

Design tokens that start in code and land in Figma:

- **Palettes in OKLCH** from one brand colour per scale. Each step's lightness is solved to hit a contrast on white, so a step means the same contrast in every hue. APCA floors are checked for dark mode, and every colour is fitted to Display P3 or sRGB.
- **Fluid type and space** from Utopia settings, with the same maths as [utopia.fyi](https://utopia.fyi) (`utopia-core`).
- **Type rules**: letter spacing and line height worked out for every type step, and typography roles that become Figma text style groups.
- **Breakpoints** (optional) and a `_fluid.scss` helper for one-off fluid values, on the same viewport as the scales.
- **A Figma plugin**, built for each project from its own configs, that writes the primitives, the fluid tokens that alias them, scopes, code syntax and text styles into the project's file. It dry-runs first and never deletes. Its **Export** button pulls the semantics Figma owns back into the repository as one file the build reads.

## Starting a project

```bash
s58-tokens init --name="Acme" --brand="#E50E3F" --accent="#F3A512" --neutral="#8B8D92" \
  --file-key="https://www.figma.com/design/<file key>/Acme"
s58-tokens build
s58-tokens figma plugin
```

`init` writes `design-tokens/` with S58 Marketing's structure and rules and placeholder brand inputs:

- **Kept from S58 Marketing:** the contrast ladder, chroma curve and APCA floors; the letter spacing and line height rules; the Utopia settings and viewport, as a first guess to tune at kickoff; and the Figma collection, group and role names. They match the S58 starter Figma file.
- **Placeholders:** three colour scales (brand, accent and a neutral across the whole range), from the colours given or placeholder ones. Inter for every font family.
- **Left out until the project needs them:** breakpoints, `_fluid.scss` (it needs `utopia-core-scss`), the semantic colours (pull them with the plugin's Export first) and a formatter. `tokens.config.ts` shows each one, commented out.

The built SCSS goes to `src/styles/tokens` (`--out=` to change it). `--file-key=` records the project's Figma file: paste its link (**Share → Copy link**), in quotes, or just its key, the part of the link after `/design/`. A branch's link gives the main file's key. `--id=` sets the plugin id (default `<name>-tokens-dev`), and `--force` overwrites existing files; without it, `init` refuses.

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

**Misspelt keys are errors, not ignored.** Each helper takes only the keys its config has, all the way down, and Figma scopes are typed too, so the editor and `tsc` flag `colorScopes` for `colourScopes`, or `SHAPE_FIL` for `SHAPE_FILL`. jiti doesn't check types, so the helpers also check when the config loads, and the command stops with the nearest key: `"colorScopes" isn't a setting in figmaVariables. Did you mean "colourScopes"?`

## The command

Run it from the project root, usually through the project's `package.json` scripts:

```bash
s58-tokens generate                 # the DTCG files in design-tokens/generated
s58-tokens build                    # generate, then every file in build.files, breakpoints and _fluid.scss
s58-tokens check                    # read only, for CI: exits 1 when something's wrong
s58-tokens palette report           # contrast on white and black, APCA floors, gamut fit
s58-tokens figma plugin [--watch]   # <plugin dir>/code.js, all modules
s58-tokens figma script variables --dry-run --collections=Primitives   # for the Figma MCP's use_figma
s58-tokens figma script colour-scopes --dry-run
s58-tokens figma script text-styles --dry-run --roles=heading,default
s58-tokens figma script export --collections=Colours                  # read only: the semantics Figma owns
```

`--config=<file>` reads another config.

## The build

`s58-tokens build` writes the primitives as DTCG files (format 2025.10) to `design-tokens/generated/`: `palette.tokens.json` and `fluid.tokens.json`. Commit them; other tools and platforms can read them. It then reads them, plus the semantics Figma owns (`build.semantics`, below), through [Style Dictionary](https://styledictionary.com) 5 and writes each file in `build.files`:

- **Names** come from each token's Figma code syntax (`com.figma.codeSyntax.WEB`). The generated tokens carry the same code syntax the plugin writes into Figma, and a semantic token without code syntax doesn't reach code.
- **The semantic colours** go in under `color.<mode>`, and each alias to `primitive/colors/…` becomes a reference to the generated palette.
- **Formats** in the package: `s58/scss/colour-primitives`, `s58/scss/semantic-colours`, `s58/scss/font-size-primitives`, `s58/scss/space-primitives`, `s58/scss/letter-spacing-primitives`, `s58/scss/line-height-primitives`, `s58/scss/line-height-utilities` and `s58/scss/fluid-semantics`. Each reads the whole dictionary and picks its tokens by path. A project adds its own under `build.formats`, using the helpers the package exports (`semanticColourEntries`, `fluidEntries`, `fontSizeEntries`).

Each built file goes through the project's formatter as it's written, when the config names one (`format: { command: ['oxfmt', '--stdin-filepath={file}'] }`), so the build writes what the repository keeps. `builtFiles(config)` returns the same files without writing them, for tests.

## Pulling Figma's semantics

The semantics designers make in Figma (colour roles, Buttons, Forms…) reach code through one file, the **pulled file**, by convention `design-tokens/figma/semantics.tokens.json`:

- **From the plugin:** press **Export**. The browser saves `semantics.tokens.json`; put it in `design-tokens/figma/`, run `s58-tokens build` and commit.
- **Through the Figma MCP:** `s58-tokens figma script export` prints the same code for `use_figma`; save the `tokens` it returns. `use_figma` returns at most 48,000 bytes, so a large file needs `--collections=`, one collection at a time, or the plugin.

The file holds every collection Figma owns, one tree per collection, with every mode's value in `$extensions['com.signal58.modes']` and every alias as a reference by collection and name (`{Primitives.primitive.colors.amber.6}`). Code syntax, scopes and descriptions come too; variable ids don't, so the file changes only when the tokens do. The variables the plugin writes from code are left out. Raw colours are in the file's colour profile, unlike Figma's own export, which labels Display P3 values `srgb`.

`build.semantics` says what the build reads from it:

```ts
semantics: {
  file: 'design-tokens/figma/semantics.tokens.json',
  colours: { collection: 'Colours', modes: { light: 'Light', dark: 'Dark' } },
  fluid: { collection: 'Fluid tokens', mode: 'Max', groups: ['Buttons', 'Forms', 'Icons'] },
},
```

A reference to a collection the build doesn't read stops the build, naming the token. Figma's own exports, one file per mode (`semantics: { colours: { light: '…/light.tokens.json' }, fluid: { file, groups } }`), still work.

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

### Colour scopes

A variable's scopes decide which pickers it appears in. The plugin sets them for the variables it writes: the colour primitives from `figma.scopes` in the palette config, and the fluid tokens from the Figma variables config. Semantic colours belong to Figma, but a project can still set where they appear, with `colourScopes` in the Figma variables config:

```ts
colourScopes: [
  // Text colours, also for vector fills (imported SVG logos) and strokes.
  { collection: 'Colours', group: 'Typography', scopes: ['TEXT_FILL', 'SHAPE_FILL', 'STROKE_COLOR'] },
  // One variable that differs from its group: the most specific group wins.
  { collection: 'Colours', group: 'Typography/link-bg', scopes: ['FRAME_FILL', 'SHAPE_FILL'] },
],
```

- A rule covers every colour variable under `group` in `collection`, or the one variable whose full name is `group`.
- The scopes replace what's in Figma. Change them in the config, not in Figma, or the next Apply puts the config's back.
- Only scopes change. The module never creates, renames or deletes a variable, or changes a value or alias.
- A rule that matches nothing is a warning in the report, so a renamed group shows up.
- Colour scopes are `ALL_SCOPES`, `ALL_FILLS`, `FRAME_FILL`, `SHAPE_FILL`, `TEXT_FILL`, `STROKE_COLOR` and `EFFECT_COLOR`. `SHAPE_FILL` covers vector layers. `ALL_FILLS` already includes the three fills, and an empty list hides the variables from every picker.

It runs in the plugin after the variables module, and as `s58-tokens figma script colour-scopes` for `use_figma`.

### The file guard

The plugin and every `use_figma` script check which Figma file they're in before they read or change anything, so one project's tokens can't land in another project's file. They compare the file's key with `figma.fileKey` in `tokens.config.ts`, and refuse:

- any other file;
- every file while `figma.fileKey` is empty (`init` leaves it empty unless given `--file-key=`). The message then names the open file's key, so running the plugin once on the project's new file tells you what to record. `figma.fileKey` must be a bare key: the config refuses a link and says which key to use.

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

A release is a version bump on `main`, then the **Release** workflow, which builds and tags it. Projects install the tag, and `main` keeps only the source.

### Releasing a version

1. Start from an up-to-date `main`:

   ```bash
   git switch main && git pull
   ```

2. Set the version in `package.json`. `--no-git-tag-version` stops npm committing and tagging, because the workflow tags:

   ```bash
   npm version 0.4.0 --no-git-tag-version
   ```

3. In `CHANGELOG.md`, rename `## Unreleased` to `## 0.4.0`. The workflow uses that section as the GitHub release's notes.

4. Check that `git diff` shows only those two lines, then commit and push:

   ```bash
   git commit -am "chore: release 0.4.0" && git push origin main
   ```

5. Run the workflow, on `main`, with the version **without the `v`** (`0.4.0`, not `v0.4.0`): **Actions → Release → Run workflow**, or:

   ```bash
   gh workflow run release.yml -f version=0.4.0
   ```

   `gh run watch` follows it, and `gh release view v0.4.0` shows the result.

Use a minor version (`0.4.0`) for anything that changes what a project must do or adds a feature, and a patch (`0.3.1`) for fixes, while the package is `0.x`. Write each change into `## Unreleased` in the PR that makes it, so the changelog is ready when you release.

### What the workflow does

1. Runs CI: formatting, lint, types, tests and `check:package`.
2. Checks the version. It stops, with nothing built or tagged, when:
   - `package.json` says another version (`package.json says 0.3.0, not 0.4.0.`): do steps 2 to 4, then run it again;
   - the tag exists already (`v0.4.0 is tagged already.`): pick the next version;
   - `CHANGELOG.md` has no heading for it (`CHANGELOG.md has no ## 0.4.0.`).
3. Builds `dist/` and commits it with a `package.json` whose `exports` point at it and whose build-at-install script is removed, on a release commit that only the tag points to, so installing the tag builds nothing. It pushes the `v0.4.0` tag.
4. Creates the GitHub release with the changelog section as its notes.

A failed run leaves nothing to clean up: fix the cause and run it again.

### Upgrading a project

Change the tag in the project's `package.json`, then install:

```json
"@signal58/design-tokens": "github:Signal-58/design-tokens#v0.4.0"
```

```bash
pnpm install
```

Then run the project's token build and check. Rebuild the Figma plugin when the changelog mentions the plugin. A release can change the manifest the check expects, as v0.2.0 did, and `s58-tokens figma plugin` updates it.
