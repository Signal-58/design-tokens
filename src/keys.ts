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
type Unknown<K> = `${K & string} isn't a setting here. Check its spelling.`

/**
 * `T` with every key `Shape` lacks turned into an error, all the way down: nested objects, arrays
 * of objects and records. Where `Shape` is a union (a number or an object, say), any member goes.
 */
export type Exactly<T, Shape> = [Shape] extends [readonly (infer S)[]]
  ? { [I in keyof T]: Exactly<T[I], S> }
  : Shape extends (...args: never[]) => unknown
    ? T
    : Shape extends object
      ? string extends keyof Shape
        ? { [K in keyof T]: Exactly<T[K], Shape[string & keyof Shape]> }
        : {
            [K in keyof T]: K extends keyof Shape
              ? Exactly<T[K], NonNullable<Shape[K]>>
              : Unknown<K>
          }
      : T

/**
 * Every key of `T`, as a list for `checkKeys`. It's a type error to leave one out, so the list
 * can't fall behind the interface.
 */
export const keysOf =
  <T>() =>
  <const K extends readonly (keyof T & string)[]>(
    ...keys: K &
      ([Exclude<keyof T, K[number]>] extends [never]
        ? unknown
        : { missing: Exclude<keyof T, K[number]> })
  ): readonly string[] =>
    keys

/** Edit distance, ignoring case: how many letters to add, remove or change. */
function distance(a: string, b: string): number {
  a = a.toLowerCase()
  b = b.toLowerCase()
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}

/**
 * Throws on a key of `value` that isn't in `known`, naming the nearest known key when it looks
 * like a misspelling. `where` says which config: `figmaVariables`, `typography.roles.brand`.
 */
export function checkKeys(where: string, value: unknown, known: readonly string[]): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  for (const key of Object.keys(value)) {
    if (known.includes(key)) continue
    const nearest = known.map((k) => ({ k, d: distance(key, k) })).sort((a, b) => a.d - b.d)[0]
    const hint =
      nearest && nearest.d <= Math.max(2, Math.floor(key.length / 3))
        ? ` Did you mean "${nearest.k}"?`
        : ` It takes ${known.map((k) => `"${k}"`).join(', ')}.`
    throw new Error(`"${key}" isn't a setting in ${where}.${hint}`)
  }
}
