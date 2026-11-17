#!/usr/bin/env node
/*
 * The s58-tokens command. In this repository it runs the TypeScript source through jiti, so nothing
 * has to be built first; the published package has no src/ and runs the build in dist/.
 */
import { existsSync } from 'node:fs'

const source = new URL('../src/cli.ts', import.meta.url)
if (existsSync(source)) {
  const { createJiti } = await import('jiti')
  await createJiti(import.meta.url).import(source.href)
} else {
  await import(new URL('../dist/cli.js', import.meta.url).href)
}
