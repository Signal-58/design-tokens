/**
 * The code syntax module: names the semantics Figma owns that have no code syntax, by the
 * project's rules (`build.semantics.codeSyntax`), so every semantic not excluded reaches code.
 * It writes code syntax only, never values or names (src/semantics/rules.ts).
 */
import { type FileGuard } from './inline.js';
import type { VariablesSpec } from './variables.js';
export interface CodeSyntaxSpec {
    /** `<collection>\u0000<name>` for every variable the plugin writes from code. Left alone. */
    owned: string[];
    /** Collections and groups that stay in Figma. */
    exclude: string[];
    /** Group (`Fluid tokens/Grid`) → prefix (`grid`). */
    rules: Record<string, string>;
}
export declare function buildCodeSyntaxSpec(variables: VariablesSpec, rules: Readonly<Record<string, string>>, exclude?: readonly string[]): CodeSyntaxSpec;
/** The use_figma script for the code syntax module. */
export declare function buildCodeSyntaxScript(spec: CodeSyntaxSpec, dryRun: boolean, guard: FileGuard): string;
