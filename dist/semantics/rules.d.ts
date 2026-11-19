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
import type { BuildConfig, PulledSemantics } from '../style-dictionary/index.js';
/** Whether the build reads the pulled file (rather than Figma's own exports). */
export declare const isPulled: (semantics: BuildConfig['semantics']) => semantics is PulledSemantics;
/** Whether `group` (`Collection/Group/…`) is the token `collection`/`name` or one of its groups. */
export declare function covers(group: string, collection: string, name: string): boolean;
/** Whether the token is excluded from code. */
export declare function isExcluded(exclude: readonly string[] | undefined, collection: string, name: string): boolean;
/** `Two thirds` → `two-thirds`, `Whole—Half` → `whole-half`, `Step -1` → `step-1`. */
export declare function kebab(text: string): string;
/**
 * The code syntax the rules give a token, or undefined when no rule covers it. The most specific
 * rule (the longest group) wins.
 */
export declare function codeSyntaxFor(rules: Readonly<Record<string, string>> | undefined, collection: string, name: string): string | undefined;
