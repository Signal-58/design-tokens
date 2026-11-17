import { type TextStyleSpec } from './figma/text-styles.js';
import { type FigmaVariablesConfig, type VariablesSpec } from './figma/variables.js';
import type { UtopiaConfig } from './fluid/utopia.js';
import type { PaletteConfig } from './palette/types.js';
import type { BuildConfig } from './style-dictionary/index.js';
import type { BreakpointsConfig, FluidToolConfig } from './responsive/breakpoints.js';
import type { TypographyConfig } from './type/rules.js';
export interface TokensConfig {
    /** The project, as people call it: `S58 Marketing`. */
    name: string;
    figma: {
        /** The Figma file the tokens belong to. */
        fileKey: string;
        /** The project's development plugin. The id must be unique among the plugins a designer imports. */
        plugin: {
            name: string;
            id: string;
            /** Where manifest.json and code.js go, from the project root. Default `design-tokens/figma-plugin`. */
            dir?: string;
        };
    };
    palette: PaletteConfig;
    utopia: UtopiaConfig;
    typography: TypographyConfig;
    figmaVariables: FigmaVariablesConfig;
    /** Optional: breakpoint SCSS and CSS custom properties. */
    breakpoints?: BreakpointsConfig;
    /** Where `_fluid.scss` goes. Without it, no helper is written. */
    fluidTool?: FluidToolConfig;
    /** Where `s58-tokens generate` writes the DTCG files, from the project root. Default `design-tokens/generated`. */
    generated?: string;
    /** What `s58-tokens build` writes with Style Dictionary, and the Figma exports it reads. */
    build?: BuildConfig;
    /**
     * The project's formatter, run on each built file (not the DTCG files) through stdin. `{file}`
     * is the file's path, so the formatter picks the right parser and config:
     * `['oxfmt', '--stdin-filepath={file}']`.
     */
    format?: {
        command: readonly string[];
    };
    check?: {
        /** APCA floor misses the project accepts, as `<scale> <step> on <white|black>`: `amber 6 on white`. */
        allowApcaMisses?: readonly string[];
    };
}
/** Checks the config and returns it. The CLI reads it as the default export of tokens.config.ts. */
export declare function defineTokens<const T extends TokensConfig>(config: T): T;
export declare const DEFAULT_CONFIG_PATH = "design-tokens/tokens.config.ts";
/**
 * Loads a project's token config with jiti, so it can stay TypeScript and import the other configs.
 * `fresh` skips jiti's caches, for watch mode.
 */
export declare function loadTokensConfig(file?: string, { fresh }?: {
    fresh?: boolean;
}): Promise<TokensConfig>;
/** The variables module's spec for a project: Utopia, letter spacing and colour primitives. */
export declare function variablesSpecFor(config: TokensConfig): VariablesSpec;
/** The text styles module's spec for a project, for all roles or the ones named. */
export declare function textStylesSpecFor(config: TokensConfig, roles?: readonly string[]): TextStyleSpec;
