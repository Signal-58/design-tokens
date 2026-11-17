/** The source of a `*.figma.js` file in this folder, ready to inline. */
export declare function inlineFigmaFunction(file: string): string;
/** A use_figma script: the function, its spec, and a call. Top-level await and return, no imports. */
export declare function figmaScript(file: string, fn: string, spec: unknown, dryRun: boolean): string;
