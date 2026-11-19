/**
 * The code syntax module: names the semantics Figma owns that have no code syntax, by the
 * project's rules (`build.semantics.codeSyntax`), so every semantic not excluded reaches code.
 * It writes code syntax only, never values or names (src/semantics/rules.ts).
 */
import { figmaScript } from './inline.js';
export function buildCodeSyntaxSpec(variables, rules, exclude = []) {
    for (const [group, prefix] of Object.entries(rules)) {
        if (!group.trim())
            throw new Error('build.semantics.codeSyntax: a rule has no group');
        if (typeof prefix !== 'string') {
            throw new Error(`build.semantics.codeSyntax: "${group}" needs a prefix ('' for none)`);
        }
    }
    return {
        owned: variables.collections.flatMap((c) => c.variables.map((v) => `${c.name}\u0000${v.name}`)),
        exclude: [...exclude],
        rules: { ...rules },
    };
}
/** The use_figma script for the code syntax module. */
export function buildCodeSyntaxScript(spec, dryRun, guard) {
    return figmaScript('apply-code-syntax.figma.js', 'applyCodeSyntax', spec, dryRun, guard);
}
