/**
 * Every semantic in the pulled file that `colours` and `fluid` don't already read, as DTCG under
 * `semantic.<collection>`, so the `s58/scss/semantics` format can write it. Plus the code-owned
 * variables those semantics alias that the generated tokens don't hold (the Utopia steps by
 * viewport, `Space @min/S`), under `owned.<collection>`, as plain numbers.
 *
 * Each semantic keeps every mode's value (`com.signal58.modes`) as a reference into this tree:
 * - to a semantic in the pulled file: `{semantic.<collection>.…}`, or `{fluid.…}` for the fluid
 *   groups `fluid.groups` lists, which `pulledFluidTokens` adds;
 * - to a code-owned fluid token: `{fluid.…}` (the generated `fluid.tokens.json`);
 * - to a palette primitive: `{primitive.…}`;
 * - to another code-owned variable: `{owned.<collection>.…}`.
 *
 * Excluded tokens (`exclude`) stay in the tree without code syntax, so references through them
 * still resolve. A reference to anything else (a library variable, say) stops the build, unless
 * the token is excluded and nothing included resolves through it.
 */
import type { PulledSemantics } from '../style-dictionary/index.js';
import type { DtcgTree } from '../dtcg/generate.js';
import type { VariablesSpec } from '../figma/variables.js';
type Json = Record<string, unknown>;
export declare const MODES_EXTENSION = "com.signal58.modes";
export declare const SCOPES_EXTENSION = "com.figma.scopes";
/** On a token whose alias the build can't follow: the reference, for the error if anything needs it. */
export declare const UNRESOLVED_EXTENSION = "com.signal58.unresolved";
/** On each semantic token: its collection's modes, in order, and the default. */
export declare const COLLECTION_EXTENSION = "com.signal58.collection";
/**
 * The `semantic` and `owned` trees. `paletteCollection` is the collection the palette primitives
 * live in, and `fluidCollection` the one the generated fluid tokens do: both are already in the
 * generated tokens.
 */
export declare function semanticTree(json: Json, semantics: PulledSemantics, spec: VariablesSpec, paletteCollection: string, fluidCollection: string): DtcgTree;
/**
 * Removes code syntax from the excluded tokens of a converted tree (`color.<mode>` or `fluid`),
 * so no format writes them. `strip` is how many leading path parts aren't the token's name
 * (2 for `color.light`, 1 for `fluid`).
 */
export declare function stripExcluded(tree: DtcgTree, collection: string, exclude: readonly string[], strip: number): DtcgTree;
export {};
