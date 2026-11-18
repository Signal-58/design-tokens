import { describe, expect, it } from 'vitest'

import {
  checkKeys,
  defineFigmaVariables,
  definePalette,
  defineTokens,
  defineTypography,
  defineUtopia,
  type TokensConfig,
} from '../src/index'

// Every misspelling below must be a type error (the @ts-expect-error lines fail `tsc` if it isn't)
// and must throw when the config loads, because the CLI loads configs without checking types.

const figmaVariables = {
  type: { collection: 'Type primitives', minGroup: 'Font size @min', maxGroup: 'Font size @max' },
  letterSpacing: {
    collection: 'Type primitives',
    minGroup: 'Letter spacing @min',
    maxGroup: 'Letter spacing @max',
  },
  space: {
    collection: 'Space primitives',
    minGroup: 'Space @min',
    maxGroup: 'Space @max',
    fixed: {},
  },
  fluid: {
    collection: 'Fluid tokens',
    modes: { min: 'Min', max: 'Max' },
    fontSizeGroup: 'Font size',
    letterSpacingGroup: 'Letter spacing',
    spaceGroup: 'Space size',
    pairsGroup: 'Space size pairs',
    customPairsGroup: 'Space size pairs/Custom pairs',
    namedPairs: {},
  },
}

describe('checkKeys', () => {
  it('names the nearest key for a misspelling', () => {
    expect(() =>
      checkKeys('figmaVariables', { colorScopes: [] }, ['fluid', 'colourScopes']),
    ).toThrow('"colorScopes" isn\'t a setting in figmaVariables. Did you mean "colourScopes"?')
  })

  it('lists the keys when nothing is close', () => {
    expect(() => checkKeys('palette.figma', { banana: 1 }, ['group', 'scopes'])).toThrow(
      '"banana" isn\'t a setting in palette.figma. It takes "group", "scopes".',
    )
  })
})

describe('defineFigmaVariables', () => {
  it('accepts colourScopes, with typed scopes', () => {
    expect(() =>
      defineFigmaVariables({
        ...figmaVariables,
        colourScopes: [
          { collection: 'Colours', group: 'Typography', scopes: ['TEXT_FILL', 'SHAPE_FILL'] },
        ],
      }),
    ).not.toThrow()
  })

  it('rejects colorScopes, the US spelling', () => {
    expect(() =>
      defineFigmaVariables({
        ...figmaVariables,
        // @ts-expect-error: the key is colourScopes
        colorScopes: [{ collection: 'Colours', group: 'Typography', scopes: ['TEXT_FILL'] }],
      }),
    ).toThrow('Did you mean "colourScopes"?')
  })

  it('rejects one rule where it takes a list', () => {
    expect(() =>
      defineFigmaVariables({
        ...figmaVariables,
        // @ts-expect-error: colourScopes is a list of rules
        colourScopes: { collection: 'Colours', group: 'Typography', scopes: ['TEXT_FILL'] },
      }),
    ).toThrow('figmaVariables.colourScopes must be a list of rules')
  })

  it('rejects a misspelt scope, and a misspelt key in a rule', () => {
    expect(() =>
      defineFigmaVariables({
        ...figmaVariables,
        // @ts-expect-error: SHAPE_FIL isn't a scope
        colourScopes: [{ collection: 'Colours', group: 'Typography', scopes: ['SHAPE_FIL'] }],
      }),
    ).toThrow("SHAPE_FIL isn't a colour scope")
    expect(() =>
      defineFigmaVariables({
        ...figmaVariables,
        colourScopes: [
          // @ts-expect-error: the key is group
          { collection: 'Colours', grup: 'Typography', group: 'Typography', scopes: ['TEXT_FILL'] },
        ],
      }),
    ).toThrow('"grup" isn\'t a setting in colourScopes[0]. Did you mean "group"?')
  })

  it('rejects a misspelt key in a nested setting', () => {
    expect(() =>
      defineFigmaVariables({
        ...figmaVariables,
        // @ts-expect-error: the key is fontSizeGroup
        fluid: { ...figmaVariables.fluid, fontSizeGrup: 'Font size' },
      }),
    ).toThrow('Did you mean "fontSizeGroup"?')
  })
})

describe('the other define helpers', () => {
  it('definePalette rejects misspelt keys and scopes', () => {
    const scales = { brand: '#2F5BEA' }
    // @ts-expect-error: the key is general
    expect(() => definePalette({ scales, genral: {} })).toThrow('Did you mean "general"?')
    expect(() =>
      definePalette({
        scales,
        figma: {
          collection: 'Primitives',
          group: 'primitive/colors',
          colorProfile: 'DISPLAY_P3',
          // @ts-expect-error: STROKE isn't a scope
          scopes: ['ALL_FILLS', 'STROKE'],
        },
      }),
    ).toThrow("palette.figma.scopes: STROKE isn't a colour scope")
  })

  it('defineTypography rejects a misspelt key in a role', () => {
    const typography = {
      figma: {
        fontCollection: 'Type primitives',
        fontFamilyGroup: 'Font family',
        fontWeightGroup: 'Font weight',
        sizeCollection: 'Type primitives',
        fontSizeGroup: 'Font size',
      },
      fonts: { families: { Body: 'Inter' }, weights: { Regular: 'Regular' } },
      letterSpacingScale: {},
    }
    const role = {
      figmaGroup: 'Default',
      purpose: 'Body text',
      family: 'Body',
      weight: 'Regular',
      steps: [0],
      lineHeight: 'auto',
      letterSpacing: 0,
      paragraphSpacing: 0,
    } as const
    expect(() => defineTypography({ ...typography, roles: { default: role } })).not.toThrow()
    expect(() =>
      defineTypography({
        ...typography,
        // @ts-expect-error: the key is weight
        roles: { default: { ...role, weigth: 'Regular' } },
      }),
    ).toThrow('"weigth" isn\'t a setting in typography.roles.default. Did you mean "weight"?')
  })

  it('defineUtopia and defineTokens reject misspelt keys', () => {
    expect(() =>
      // @ts-expect-error: the key is viewport
      defineUtopia({ viewpoint: {}, type: {}, space: {} }),
    ).toThrow('Did you mean "viewport"?')
    expect(() =>
      defineTokens({
        name: 'Acme',
        figma: {
          filekey: 'x',
          fileKey: '',
          plugin: { name: 'Acme Tokens', id: 'acme-tokens-dev' },
        },
      } as never),
    ).toThrow('"filekey" isn\'t a setting in figma. Did you mean "fileKey"?')
  })
})

// Never called: checks that defineTokens flags a misspelt key in a complete config.
export function tokensWithMisspeltKey(config: TokensConfig) {
  return defineTokens({
    ...config,
    figma: {
      ...config.figma,
      // @ts-expect-error: the key is fileKey
      filekey: 'x',
    },
  })
}
