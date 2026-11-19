/**
 * The code syntax module: names the semantics Figma owns that have no code syntax, by the
 * project's rules (`build.semantics.codeSyntax`), so every semantic not excluded reaches code.
 * It writes code syntax only, never values or names (src/semantics/rules.ts).
 */
import { figmaScript, type FileGuard } from './inline'
import type { VariablesSpec } from './variables'

export interface CodeSyntaxSpec {
  /** `<collection>\u0000<name>` for every variable the plugin writes from code. Left alone. */
  owned: string[]
  /** Collections and groups that stay in Figma. */
  exclude: string[]
  /** Group (`Fluid tokens/Grid`) → prefix (`grid`). */
  rules: Record<string, string>
}

export function buildCodeSyntaxSpec(
  variables: VariablesSpec,
  rules: Readonly<Record<string, string>>,
  exclude: readonly string[] = [],
): CodeSyntaxSpec {
  for (const [group, prefix] of Object.entries(rules)) {
    if (!group.trim()) throw new Error('build.semantics.codeSyntax: a rule has no group')
    if (typeof prefix !== 'string') {
      throw new Error(`build.semantics.codeSyntax: "${group}" needs a prefix ('' for none)`)
    }
  }
  return {
    owned: variables.collections.flatMap((c) => c.variables.map((v) => `${c.name}\u0000${v.name}`)),
    exclude: [...exclude],
    rules: { ...rules },
  }
}

/** The use_figma script for the code syntax module. */
export function buildCodeSyntaxScript(
  spec: CodeSyntaxSpec,
  dryRun: boolean,
  guard: FileGuard,
): string {
  return figmaScript('apply-code-syntax.figma.js', 'applyCodeSyntax', spec, dryRun, guard)
}
