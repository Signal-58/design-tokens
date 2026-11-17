/**
 * Figma file keys, as `s58-tokens init --file-key=` and `figma.fileKey` in the token config take
 * them. A key is the part of a file's link after `/design/` (or `/file/` in older links).
 */

const KEY = /^[0-9a-zA-Z]{22,128}$/

/** Whether `value` is a bare Figma file key. */
export const isFileKey = (value: string): boolean => KEY.test(value)

/**
 * The file key from a key or a Figma link:
 * `https://www.figma.com/design/<key>/Name?node-id=0-1` gives `<key>`. A branch link
 * (`/design/<key>/branch/<branch key>/…`) gives the main file's key, which the guard expects.
 */
export function fileKeyFrom(input: string): string {
  const value = input.trim()
  if (isFileKey(value)) return value
  const expected = 'expected a Figma file key or a link like figma.com/design/<file key>/…'
  let url: URL
  try {
    url = new URL(/^(www\.)?figma\.com\//.test(value) ? `https://${value}` : value)
  } catch {
    throw new Error(`"${input}" isn't a Figma file key or link: ${expected}`)
  }
  if (!/(^|\.)figma\.com$/.test(url.hostname)) {
    throw new Error(`"${input}" isn't a Figma link: ${expected}`)
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const at = parts.findIndex((p) => p === 'design' || p === 'file')
  const key = at >= 0 ? parts[at + 1] : undefined
  if (!key || !isFileKey(key)) {
    throw new Error(`No file key in "${input}": ${expected}`)
  }
  return key
}
