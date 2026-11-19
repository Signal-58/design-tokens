/**
 * Figma against the repository: what Export would change in the committed file
 * (`build.semantics.file`). Figma does the comparing (`diff-semantics.figma.js`) against a
 * fingerprint of the file, and returns only what differs, so it fits in a use_figma call even when
 * the file doesn't. The plugin's dry run shows it; `s58-tokens figma script check` gives the
 * script, and `s58-tokens figma diff|pull <result>` reads what it returns.
 *
 * `hash` and `entries` are the Node copies of the ones in diff-semantics.figma.js and must produce
 * the same; test/semantic-diff.test.ts checks that they do.
 */
import { type FileGuard } from './inline.js';
import type { VariablesSpec } from './variables.js';
/** The committed file as Figma compares it: a hash per entry and per collection's token order. */
export interface SemanticsFingerprint {
    /** The hash of the file's text, so a result is only applied to the file it was made from. */
    base: string;
    hashes: string[];
    /** Collection → the hash of its token paths, in order. */
    order: Record<string, string>;
    /** The hash of the collection names, in order. */
    collections: string;
    /** Each hash's entry, as `Collection/group/name` (or `Collection/$extensions`). The plugin only. */
    paths?: string[];
}
export interface DiffSpec {
    /** The hash of each code-owned `<collection>\u0000<name>`: the export's `owned`, smaller. */
    ownedHashes: string[];
    collections?: string[];
    committed: SemanticsFingerprint;
}
/** An entry of the export: a token, a collection's `$extensions`, or the file's `$extensions`. */
interface Entry {
    path: string[];
    value: unknown;
}
/** What the diff returns, from the plugin or use_figma. */
export interface SemanticsDiff {
    format: 1;
    base: string;
    /** The hash of `[changed, missing, order]`, so a copy that changed on the way is refused. */
    check: string;
    /** In Figma and not in the file: added or changed. */
    changed: Entry[];
    /** Hashes of the file's entries that Figma doesn't have as they are: removed or changed. */
    missing: string[];
    order: {
        tokens: Record<string, string[]>;
        collections?: string[];
    };
    report: {
        collections: {
            name: string;
            variables: number;
        }[];
        codeOwned: number;
        warnings: string[];
    };
    summary?: DiffSummary;
}
export interface DiffSummary {
    added: string[];
    changed: string[];
    removed: string[];
    /** Collections whose tokens only moved, and `(the collections)` when their order changed. */
    reordered: string[];
}
/** cyrb53: a fast 53-bit string hash, in base 36. The same as in diff-semantics.figma.js. */
export declare function hash(text: string): string;
/**
 * The fingerprint of the committed file (its text, as read from disk). `paths` names each hash,
 * for the plugin, which has room for them; a use_figma script leaves them out.
 */
export declare function fingerprint(text: string, options?: {
    collections?: readonly string[];
    paths?: boolean;
}): SemanticsFingerprint;
/** The diff's spec: the export's, plus the fingerprint of the committed file. */
export declare function buildDiffSpec(variables: VariablesSpec, committed: string, options?: {
    collections?: readonly string[];
    paths?: boolean;
}): DiffSpec;
/**
 * The use_figma script for the check. It returns a `SemanticsDiff`: save it as JSON and run
 * `s58-tokens figma diff <file>` to read it, or `s58-tokens figma pull <file>` to apply it.
 */
export declare function buildDiffScript(spec: DiffSpec, guard: FileGuard): string;
/**
 * Applies a diff to the committed file: the file Export would write now, and what changed. It
 * throws when the diff was made from another version of the file, or doesn't fit it.
 */
export declare function applySemanticsDiff(committed: string, diff: SemanticsDiff): {
    text: string;
    summary: DiffSummary;
};
/** The summary as text, for the CLI. */
export declare function describeDiff(summary: DiffSummary, warnings?: readonly string[]): string;
export {};
