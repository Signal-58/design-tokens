import { type ColourScopesSpec } from './figma/colour-scopes.js';
import { type CodeSyntaxSpec } from './figma/code-syntax.js';
import type { FileGuard } from './figma/inline.js';
import { type Exactly } from './keys.js';
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
        /**
         * The Figma file the tokens belong to, from its URL: figma.com/design/<file key>/…. The plugin
         * and the use_figma scripts refuse to run on any other file, or while this is empty.
         */
        fileKey: string;
        /**
         * Optional: the file's name, which the guard checks only when Figma doesn't give the plugin the
         * file's key. Renaming the file then stops the plugin until this is updated.
         */
        fileName?: string;
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
/**
 * Checks the config, including that it has no unknown or misspelt keys, and returns it. The CLI
 * reads it as the default export of tokens.config.ts.
 */
export declare function defineTokens<const T extends TokensConfig>(config: T & Exactly<T, TokensConfig>): T;
export declare const DEFAULT_CONFIG_PATH = "design-tokens/tokens.config.ts";
/**
 * Loads a project's token config with jiti, so it can stay TypeScript and import the other configs.
 * `fresh` skips jiti's caches, for watch mode.
 */
export declare function loadTokensConfig(file?: string, { fresh }?: {
    fresh?: boolean;
}): Promise<TokensConfig>;
/** The Figma file the project's plugin and use_figma scripts may touch. */
export declare function fileGuardFor(config: TokensConfig): FileGuard;
/** The variables module's spec for a project: Utopia, letter spacing and colour primitives. */
export declare function variablesSpecFor(config: TokensConfig): VariablesSpec;
/** The colour scopes module's spec for a project, or undefined when it sets none. */
export declare function colourScopesSpecFor(config: TokensConfig): ColourScopesSpec | undefined;
/**
 * The code syntax module's spec for a project, or undefined when it reads Figma's own exports or
 * sets no rules (`build.semantics.codeSyntax`).
 */
export declare function codeSyntaxSpecFor(config: TokensConfig): CodeSyntaxSpec | undefined;
/** The text styles module's spec for a project, for all roles or the ones named. */
export declare function textStylesSpecFor(config: TokensConfig, roles?: readonly string[]): TextStyleSpec;
