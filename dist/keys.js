/**
 * Unknown keys in a project's configs. A misspelt key, such as `colorScopes` for `colourScopes`,
 * would otherwise be ignored without a word. Two layers catch it:
 *
 * - `Exactly` makes every `define*` helper reject keys its config doesn't have, so the editor and
 *   `tsc` flag them.
 * - `checkKeys` throws when the config loads, because the CLI loads configs with jiti, which strips
 *   types without checking them.
 */
/**
 * Every key of `T`, as a list for `checkKeys`. It's a type error to leave one out, so the list
 * can't fall behind the interface.
 */
export const keysOf = () => (...keys) => keys;
/** Edit distance, ignoring case: how many letters to add, remove or change. */
function distance(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        previous = current;
    }
    return previous[b.length];
}
/**
 * Throws on a key of `value` that isn't in `known`, naming the nearest known key when it looks
 * like a misspelling. `where` says which config: `figmaVariables`, `typography.roles.brand`.
 */
export function checkKeys(where, value, known) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return;
    for (const key of Object.keys(value)) {
        if (known.includes(key))
            continue;
        const nearest = known.map((k) => ({ k, d: distance(key, k) })).sort((a, b) => a.d - b.d)[0];
        const hint = nearest && nearest.d <= Math.max(2, Math.floor(key.length / 3))
            ? ` Did you mean "${nearest.k}"?`
            : ` It takes ${known.map((k) => `"${k}"`).join(', ')}.`;
        throw new Error(`"${key}" isn't a setting in ${where}.${hint}`);
    }
}
