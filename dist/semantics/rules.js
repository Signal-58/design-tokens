/**
 * Which of Figma's semantics reach code, and what they're called there (`build.semantics`):
 *
 * - `exclude` lists collections and groups that stay in Figma, by path: `Sizes`, or
 *   `Fluid tokens/Layout/Hero`. An excluded token gets no code syntax from the plugin and no CSS,
 *   and a reference through it resolves to the next token that has a CSS name.
 * - `codeSyntax` names the tokens Figma hasn't named, by rule: a group's prefix plus the rest of
 *   the token's name in kebab case (`Fluid tokens/Grid` → `grid`, so `Grid/Two thirds` is
 *   `grid-two-thirds`). The most specific group wins. The plugin writes the names into Figma,
 *   so designers see them too; code syntax a designer set is never changed.
 *
 * The plugin's code runs the same rules (`apply-code-syntax.figma.js`), tested against these.
 */
/** Whether the build reads the pulled file (rather than Figma's own exports). */
export const isPulled = (semantics) => !!semantics && 'file' in semantics;
/** A path's parts: `Fluid tokens/Layout/Hero` → `['Fluid tokens', 'Layout', 'Hero']`. */
const partsOf = (path) => path.split('/').filter(Boolean);
/** Whether `group` (`Collection/Group/…`) is the token `collection`/`name` or one of its groups. */
export function covers(group, collection, name) {
    const g = partsOf(group);
    const t = [collection, ...partsOf(name)];
    return g.length <= t.length && g.every((part, i) => part === t[i]);
}
/** Whether the token is excluded from code. */
export function isExcluded(exclude, collection, name) {
    return (exclude ?? []).some((group) => covers(group, collection, name));
}
/** `Two thirds` → `two-thirds`, `Whole—Half` → `whole-half`, `Step -1` → `step-1`. */
export function kebab(text) {
    return text
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
/**
 * The code syntax the rules give a token, or undefined when no rule covers it. The most specific
 * rule (the longest group) wins.
 */
export function codeSyntaxFor(rules, collection, name) {
    let best;
    for (const [group, prefix] of Object.entries(rules ?? {})) {
        if (!covers(group, collection, name))
            continue;
        if (!best || partsOf(group).length > partsOf(best.group).length)
            best = { group, prefix };
    }
    if (!best)
        return undefined;
    const rest = [collection, ...partsOf(name)].slice(partsOf(best.group).length);
    return [kebab(best.prefix), ...rest.map(kebab)].filter(Boolean).join('-');
}
