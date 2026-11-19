/**
 * The export: the semantics Figma owns, read out of the file as one DTCG file that the build reads
 * (`build.semantics.file`, by convention `design-tokens/figma/semantics.tokens.json`). The plugin's
 * Export button and `s58-tokens figma script export` run the same code
 * (`export-semantics.figma.js`). It replaces Figma's own variable export, which writes one file per
 * mode and labels Display P3 colours `srgb`.
 */
import { figmaScript } from './inline.js';
/** The export's spec: everything but what the variables module writes, or only some collections. */
export function buildExportSpec(variables, collections) {
    return {
        owned: variables.collections.flatMap((c) => c.variables.map((v) => `${c.name}\u0000${v.name}`)),
        ...(collections ? { collections: [...collections] } : {}),
    };
}
/** The use_figma script for the export. It returns `{ tokens, report }`; write `tokens` to the file. */
export function buildExportScript(spec, guard) {
    return figmaScript('export-semantics.figma.js', 'exportSemantics', spec, false, guard);
}
/** The pulled file as the repository keeps it: two-space JSON and a final newline. */
export function formatExport(tokens) {
    return `${JSON.stringify(tokens, null, 2)}\n`;
}
