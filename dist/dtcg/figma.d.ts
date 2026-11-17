/**
 * Figma's own variable exports (File > Export > Variables, one file per mode) turned into DTCG that
 * sits next to the generated primitives:
 *
 * - A colour export goes under `color.<mode>`, so light and dark live in one tree. A colour Figma
 *   aliases to `primitive/colors/amber/6` becomes the reference `{primitive.colors.amber.6}`, which
 *   the generated palette defines. Figma's resolved values are dropped: in a Display P3 file they're
 *   P3 numbers labelled `srgb`.
 * - The Fluid tokens export goes under `fluid`, keeping only the semantic groups (Buttons, Forms…).
 *   The code-owned groups (Font size, Space size, the pairs) come from the generated tokens instead.
 *
 * References inside a file get the same prefix. Each token keeps its type and its code syntax.
 */
import { type DtcgTree } from './generate.js';
type Json = Record<string, unknown>;
/** One mode of Figma's colour export, under `color.<mode>`. */
export declare function figmaColourTokens(json: Json, mode: string): DtcgTree;
/** The semantic groups of Figma's Fluid tokens export, in the order given, under `fluid`. */
export declare function figmaFluidTokens(json: Json, groups: readonly string[]): DtcgTree;
/** Merges DTCG trees, group by group. A token defined twice is an error. */
export declare function mergeTrees(...trees: DtcgTree[]): DtcgTree;
export {};
