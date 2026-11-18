/**
 * The development plugin's manifest.json, which a designer imports once in Figma desktop.
 * `enablePrivatePluginApi` gives the plugin `figma.fileKey`, which the file guard checks.
 */
export declare function pluginManifest(plugin: {
    name: string;
    id: string;
}): string;
