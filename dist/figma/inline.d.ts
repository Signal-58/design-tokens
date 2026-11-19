/** The source of a `*.figma.js` file in this folder, ready to inline. */
export declare function inlineFigmaFunction(file: string): string;
/**
 * The Figma file a script or plugin may touch (`file-guard.figma.js`). `fileName` is the fallback
 * for when Figma doesn't give the plugin the file's key.
 */
export interface FileGuard {
    project: string;
    fileKey: string;
    fileName?: string;
}
/**
 * A use_figma script: the guard, the function, its spec, and a call. Top-level await and return,
 * no imports. The guard throws before anything is read or changed, so use_figma discards the run.
 * `also` inlines other `*.figma.js` files the function calls.
 */
export declare function figmaScript(file: string, fn: string, spec: unknown, dryRun: boolean, guard: FileGuard, also?: readonly string[]): string;
