import fs from 'fs'
import os from 'os'
import path from 'path'

import { afterAll, describe, expect, it } from 'vitest'

import {
  buildFigmaPlugin,
  buildTextStylesScript,
  buildVariablesScript,
  checkTokens,
  fileGuardFor,
  initProject,
  inlineFigmaFunction,
  loadTokensConfig,
  packageVersion,
  pluginManifest,
  type FileGuard,
} from '../src/index'
import { FILE } from './file-guard'

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

/** Runs the guard alone against a stand-in for Figma. */
async function checkFile(expected: FileGuard, figma: object) {
  const code = `${inlineFigmaFunction('file-guard.figma.js')}\nreturn await checkFile(EXPECTED)`
  return new AsyncFunction('figma', 'EXPECTED', code)(figma, expected)
}

/** A Figma whose every read or write fails the test: the guard must stop before any. */
function untouchable(fileKey: string | undefined, name = 'Some file') {
  const fail = () => {
    throw new Error('the script touched the file')
  }
  return {
    fileKey,
    root: { name, documentColorProfile: 'DISPLAY_P3' },
    variables: new Proxy({}, { get: () => fail }),
    getLocalTextStylesAsync: fail,
    loadFontAsync: fail,
    createTextStyle: fail,
  }
}

describe('checkFile', () => {
  it("passes the project's file, by its key", async () => {
    expect(await checkFile(FILE, { fileKey: FILE.fileKey, root: { name: 'x' } })).toEqual({
      ok: true,
      by: 'key',
    })
  })

  it('refuses another file, even one with the expected name', async () => {
    const result = await checkFile(
      { ...FILE, fileName: 'Test file' },
      { fileKey: 'SomeoneElsesFile00000000', root: { name: 'Test file' } },
    )
    expect(result.ok).toBe(false)
    expect(result.message).toContain("This isn't Test Project's Figma file")
    expect(result.message).toContain('SomeoneElsesFile00000000')
  })

  it('refuses every file while the config has no file key', async () => {
    const result = await checkFile({ ...FILE, fileKey: '' }, { fileKey: 'AnyFile', root: {} })
    expect(result.ok).toBe(false)
    expect(result.message).toContain("doesn't name Test Project's Figma file")
  })

  it("falls back to the file's name only when Figma gives no key", async () => {
    const named = { ...FILE, fileName: 'Test file' }
    expect(await checkFile(named, { root: { name: 'Test file' } })).toEqual({
      ok: true,
      by: 'name',
    })
    const other = await checkFile(named, { root: { name: 'Other file' } })
    expect(other.ok).toBe(false)
    expect(other.message).toContain('"Other file"')
  })

  it('refuses when Figma gives no key and the config names no file', async () => {
    const result = await checkFile(FILE, { root: { name: 'Test file' } })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('enablePrivatePluginApi')
  })
})

describe('the use_figma scripts', () => {
  const variables = buildVariablesScript({ collections: [] }, false, FILE)
  const styles = buildTextStylesScript({ styles: [], fontVariables: [] } as never, false, FILE)

  it("throw on another project's file before reading or changing anything", async () => {
    for (const script of [variables, styles]) {
      await expect(
        new AsyncFunction('figma', script)(untouchable('SomeoneElsesFile00000000')),
      ).rejects.toThrow("This isn't Test Project's Figma file")
    }
  })

  it('throw while the config has no file key', async () => {
    const script = buildVariablesScript({ collections: [] }, true, { ...FILE, fileKey: '' })
    await expect(new AsyncFunction('figma', script)(untouchable(FILE.fileKey))).rejects.toThrow(
      "doesn't name Test Project's Figma file",
    )
  })
})

describe('the plugin', () => {
  function open(fileKey: string | undefined, figma: object = untouchable(fileKey)) {
    const messages: Record<string, unknown>[] = []
    const ui = {
      postMessage: (msg: Record<string, unknown>) => messages.push(msg),
      onmessage: undefined as undefined | ((msg: { type: string }) => Promise<void> | void),
    }
    const code = buildFigmaPlugin({ variables: { collections: [] } }, FILE)
    new Function('figma', code)({
      ...figma,
      ui,
      showUI: () => {},
      closePlugin: () => {},
    })
    return { messages, ui, settle: () => new Promise((resolve) => setTimeout(resolve, 0)) }
  }

  it("shows the wrong file and runs nothing on another project's file, even on Apply", async () => {
    const plugin = open('SomeoneElsesFile00000000')
    await plugin.settle()
    expect(plugin.messages).toHaveLength(1)
    expect(plugin.messages[0]).toMatchObject({ type: 'blocked' })
    expect(plugin.messages[0].message).toContain("This isn't Test Project's Figma file")

    await plugin.ui.onmessage!({ type: 'apply' })
    expect(plugin.messages.map((m) => m.type)).toEqual(['blocked', 'blocked'])
  })

  it('reports how it checked the file and the package version', async () => {
    const plugin = open(FILE.fileKey, {
      fileKey: FILE.fileKey,
      root: { name: 'Test file', documentColorProfile: 'DISPLAY_P3' },
      variables: {
        getLocalVariableCollectionsAsync: async () => [],
        getLocalVariablesAsync: async () => [],
      },
    })
    await plugin.settle()
    expect(plugin.messages[0]).toMatchObject({
      type: 'report',
      checkedBy: 'key',
      version: packageVersion(),
    })
    expect(packageVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('shows the wrong file in its UI', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../src/figma/plugin-ui.html'), 'utf8')
    expect(ui).toContain("msg.type === 'blocked'")
    expect(ui).toContain('@signal58/design-tokens ${esc(version)}')
  })
})

describe('the manifest', () => {
  const roots: string[] = []
  afterAll(() => {
    for (const root of roots) fs.rmSync(root, { recursive: true, force: true })
  })

  it("asks Figma for the file's key", () => {
    expect(
      JSON.parse(pluginManifest({ name: 'Acme Tokens', id: 'acme-tokens-dev' })),
    ).toMatchObject({ enablePrivatePluginApi: true })
  })

  it('fails the check without enablePrivatePluginApi', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 's58-guard-'))
    roots.push(root)
    fs.mkdirSync(path.join(root, 'node_modules/@signal58'), { recursive: true })
    fs.symlinkSync(
      path.resolve(__dirname, '..'),
      path.join(root, 'node_modules/@signal58/design-tokens'),
      'dir',
    )
    initProject({ name: 'Acme', fileKey: 'AcmeFileKey0000000000000' }, { root })
    const file = path.join(root, 'design-tokens/figma-plugin/manifest.json')
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
    delete manifest.enablePrivatePluginApi
    fs.writeFileSync(file, JSON.stringify(manifest))

    const config = await loadTokensConfig(path.join(root, 'design-tokens/tokens.config.ts'))
    expect(fileGuardFor(config)).toEqual({ project: 'Acme', fileKey: 'AcmeFileKey0000000000000' })
    const { problems } = await checkTokens(config, root)
    expect(problems.filter((p) => p.includes('enablePrivatePluginApi'))).toHaveLength(1)
  })
})
