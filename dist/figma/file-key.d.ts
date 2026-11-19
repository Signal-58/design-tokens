/**
 * Figma file keys, as `s58-tokens init --file-key=` and `figma.fileKey` in the token config take
 * them. A key is the part of a file's link after `/design/` (or `/file/` in older links).
 */
/** Whether `value` is a bare Figma file key. */
export declare const isFileKey: (value: string) => boolean;
/**
 * The file key from a key or a Figma link:
 * `https://www.figma.com/design/<key>/Name?node-id=0-1` gives `<key>`. A branch link
 * (`/design/<key>/branch/<branch key>/…`) gives the main file's key, which the guard expects.
 */
export declare function fileKeyFrom(input: string): string;
