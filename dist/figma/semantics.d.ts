/**
 * The export: the semantics Figma owns, read out of the file as one DTCG file that the build reads
 * (`build.semantics.file`, by convention `design-tokens/figma/semantics.tokens.json`). The plugin's
 * Export button and `s58-tokens figma script export` run the same code
 * (`export-semantics.figma.js`). It replaces Figma's own variable export, which writes one file per
 * mode and labels Display P3 colours `srgb`.
 */
import { type FileGuard } from './inline.js';
import type { VariablesSpec } from './variables.js';
export interface ExportSpec {
    /** `<collection>\u0000<name>` for every variable the plugin writes from code. Left out of the export. */
    owned: string[];
    /** Only these collections, when set. */
    collections?: string[];
}
/** The export's spec: everything but what the variables module writes, or only some collections. */
export declare function buildExportSpec(variables: VariablesSpec, collections?: readonly string[]): ExportSpec;
/** The use_figma script for the export. It returns `{ tokens, report }`; write `tokens` to the file. */
export declare function buildExportScript(spec: ExportSpec, guard: FileGuard): string;
/** The pulled file as the repository keeps it: two-space JSON and a final newline. */
export declare function formatExport(tokens: unknown): string;
