/**
 * Every file `s58-tokens build` writes, in memory: the DTCG files, the Style Dictionary outputs,
 * the breakpoints and `_fluid.scss`. The outputs go through the project's formatter (`format`), so
 * what `build` writes and what `check` compares is what the repository keeps.
 */
import { spawnSync } from 'node:child_process'

import type { TokensConfig } from './config'
import { generateDtcg } from './dtcg/generate'
import {
  generateBreakpointsCssScss,
  generateBreakpointsScss,
  generateFluidToolScss,
  utopiaScssFrom,
} from './responsive/breakpoints'
import { buildTokenFiles } from './style-dictionary'

export interface OutputFile {
  /** From the project root. */
  destination: string
  output: string
}

/** Runs the project's format command on one file's contents, as if they were at `file`. */
export function formatOutput(config: TokensConfig, file: string, contents: string): string {
  const command = config.format?.command
  if (!command?.length) return contents
  const [cmd, ...args] = command.map((part) => part.replaceAll('{file}', file))
  const result = spawnSync(cmd, args, {
    input: contents,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command.join(' ')} failed on ${file}:\n${result.stderr}`)
  }
  return result.stdout
}

/** The generated DTCG files, as `s58-tokens generate` writes them. */
export function dtcgFiles(config: TokensConfig): OutputFile[] {
  const dir = config.generated ?? 'design-tokens/generated'
  return Object.entries(generateDtcg(config)).map(([name, tree]) => ({
    destination: `${dir}/${name}`,
    output: `${JSON.stringify(tree, null, 2)}\n`,
  }))
}

/** Every built file except the DTCG ones, formatted. */
export async function builtFiles(
  config: TokensConfig,
  root = process.cwd(),
): Promise<OutputFile[]> {
  const files = [...(await buildTokenFiles(config, root))]
  const { breakpoints, fluidTool, utopia } = config
  if (breakpoints) {
    files.push(
      {
        destination: breakpoints.output.scss,
        output: generateBreakpointsScss(breakpoints, utopia.viewport),
      },
      { destination: breakpoints.output.css, output: generateBreakpointsCssScss(breakpoints) },
    )
  }
  if (fluidTool) {
    files.push({
      destination: fluidTool.output,
      output: generateFluidToolScss(utopia.viewport, utopiaScssFrom(fluidTool.output)),
    })
  }
  return files.map((f) => ({ ...f, output: formatOutput(config, f.destination, f.output) }))
}
