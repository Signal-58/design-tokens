/** The development plugin's manifest.json, which a designer imports once in Figma desktop. */
export function pluginManifest(plugin) {
    const manifest = {
        name: plugin.name,
        id: plugin.id,
        api: '1.0.0',
        main: 'code.js',
        editorType: ['figma'],
        documentAccess: 'dynamic-page',
        networkAccess: { allowedDomains: ['none'] },
    };
    return `${JSON.stringify(manifest, null, 2)}\n`;
}
