/**
 * Runs inside Figma, before the plugin or a use_figma script reads or changes anything: it stops one
 * project's tokens landing in another project's Figma file.
 *
 * It compares the open file's key with the config's. Figma gives a plugin the key only when its
 * manifest sets `enablePrivatePluginApi` (s58-tokens writes that); use_figma always has it. Without
 * the key it falls back to the file's name, if the config names the file. Otherwise it refuses.
 *
 * @param {{ project: string, fileKey: string, fileName?: string }} expected
 * @returns {Promise<{ ok: true, by: 'key' | 'name' } | { ok: false, message: string }>}
 */
export async function checkFile(expected) {
  const where = 'figma.fileKey in design-tokens/tokens.config.ts'
  const key = typeof figma.fileKey === 'string' ? figma.fileKey : ''
  if (!expected.fileKey) {
    // Figma knows the open file's key, so say it: running the plugin once on a new file tells the
    // project what to record.
    const set = key
      ? `If this is ${expected.project}'s file, set ${where} to '${key}' (this file's key), then rebuild.`
      : `Set ${where} to the file's key (the part after /design/ in its link), then rebuild.`
    return {
      ok: false,
      message: `The config doesn't name ${expected.project}'s Figma file, so nothing was checked or changed. ${set}`,
    }
  }
  if (key) {
    if (key === expected.fileKey) return { ok: true, by: 'key' }
    return {
      ok: false,
      message:
        `This isn't ${expected.project}'s Figma file, so nothing was checked or changed. ` +
        `Its key is ${key}; ${where} says ${expected.fileKey}.`,
    }
  }
  if (expected.fileName) {
    const name = figma.root.name
    if (name === expected.fileName) return { ok: true, by: 'name' }
    return {
      ok: false,
      message:
        `This isn't ${expected.project}'s Figma file, so nothing was checked or changed. ` +
        `It's called "${name}"; figma.fileName in the config says "${expected.fileName}".`,
    }
  }
  return {
    ok: false,
    message:
      `Figma didn't tell the plugin which file this is, so nothing was checked or changed. ` +
      `Check that the plugin's manifest.json has "enablePrivatePluginApi": true (s58-tokens figma plugin adds it), ` +
      `or set figma.fileName in the config to the file's name.`,
  }
}
