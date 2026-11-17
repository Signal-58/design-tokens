#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * Packs the package as it would be published, then checks the tarball: publint for package.json and
 * file problems, attw for how TypeScript resolves the types. It checks the tarball, not this folder,
 * because pnpm swaps `exports` for `publishConfig.exports` (dist/) only when it packs. Nothing here
 * contacts the registry: attw would otherwise look up DefinitelyTyped, which this package doesn't need.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = mkdtempSync(join(tmpdir(), 'signal58-package-'))

const run = (command, args) =>
  spawnSync(command, args, { cwd: root, shell: process.platform === 'win32', stdio: 'inherit' })
    .status === 0

let ok = false
try {
  ok = run('pnpm', ['pack', '--pack-destination', out])
  const tarball = readdirSync(out).find((name) => name.endsWith('.tgz'))
  if (ok && !tarball) {
    console.error(`pnpm pack wrote no tarball to ${out}`)
    ok = false
  }
  if (ok) {
    const file = join(out, tarball)
    ok =
      run('publint', ['run', file, '--strict']) &&
      run('attw', [file, '--profile', 'esm-only', '--no-definitely-typed'])
  }
} finally {
  rmSync(out, { force: true, recursive: true })
}
process.exit(ok ? 0 : 1)
