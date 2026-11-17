/**
 * The starter configs `s58-tokens init` writes: S58 Marketing's structure and rules (its contrast
 * ladder, chroma curve and APCA floors, its letter spacing and line height rules, its Utopia
 * settings and its Figma collection, group and role names) with placeholder brand inputs: three
 * colour scales and Inter.
 */
export interface StarterOptions {
    /** The project, as people call it: `Acme`. */
    name: string;
    /** The plugin id. Default: the name in lowercase with hyphens, plus `-tokens-dev`. */
    id?: string;
    /** The Figma file, when it exists: its key or its link (the key is taken from the link). */
    fileKey?: string;
    /** Reference colours: hex or `oklch(L C H)`. */
    brand?: string;
    accent?: string;
    neutral?: string;
    /** Where the built SCSS goes, from the project root. Default `src/styles/tokens`. */
    out?: string;
}
/** Placeholders, to replace with the brand's colours. */
export declare const PLACEHOLDER_COLOURS: {
    brand: string;
    accent: string;
    neutral: string;
};
export declare const slugOf: (name: string) => string;
export declare function paletteConfig(o: StarterOptions): string;
export declare function utopiaConfig(): string;
export declare function typographyConfig(): string;
export declare function figmaVariablesConfig(): string;
export declare function tokensConfig(o: StarterOptions): string;
/** Every file init writes, by path from the project root. */
export declare function starterFiles(o: StarterOptions): Record<string, string>;
