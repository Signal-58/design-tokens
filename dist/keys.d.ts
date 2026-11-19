/**
 * Unknown keys in a project's configs. A misspelt key, such as `colorScopes` for `colourScopes`,
 * would otherwise be ignored without a word. Two layers catch it:
 *
 * - `Exactly` makes every `define*` helper reject keys its config doesn't have, so the editor and
 *   `tsc` flag them.
 * - `checkKeys` throws when the config loads, because the CLI loads configs with jiti, which strips
 *   types without checking them.
 */
/** A key `Shape` doesn't have, as a type error that names it. */
type Unknown<K> = `${K & string} isn't a setting here. Check its spelling.`;
/**
 * `T` with every key `Shape` lacks turned into an error, all the way down: nested objects, arrays
 * of objects and records. Where `Shape` is a union (a number or an object, say), any member goes.
 */
export type Exactly<T, Shape> = [Shape] extends [readonly (infer S)[]] ? {
    [I in keyof T]: Exactly<T[I], S>;
} : Shape extends (...args: never[]) => unknown ? T : Shape extends object ? string extends keyof Shape ? {
    [K in keyof T]: Exactly<T[K], Shape[string & keyof Shape]>;
} : {
    [K in keyof T]: K extends keyof Shape ? Exactly<T[K], NonNullable<Shape[K]>> : Unknown<K>;
} : T;
/**
 * Every key of `T`, as a list for `checkKeys`. It's a type error to leave one out, so the list
 * can't fall behind the interface.
 */
export declare const keysOf: <T>() => <const K extends readonly (keyof T & string)[]>(...keys: K & ([Exclude<keyof T, K[number]>] extends [never] ? unknown : {
    missing: Exclude<keyof T, K[number]>;
})) => readonly string[];
/**
 * Throws on a key of `value` that isn't in `known`, naming the nearest known key when it looks
 * like a misspelling. `where` says which config: `figmaVariables`, `typography.roles.brand`.
 */
export declare function checkKeys(where: string, value: unknown, known: readonly string[]): void;
export {};
