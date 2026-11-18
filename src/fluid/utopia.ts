/**
 * Utopia fluid type and space: the viewport and the two scales, calculated with utopia-core, the
 * same maths as utopia.fyi. A project's utopia config (defineUtopia) holds the values.
 */
import type { UtopiaSpaceConfig, UtopiaTypeConfig } from 'utopia-core'

import { checkKeys, keysOf, type Exactly } from '../keys'

export type { UtopiaSpaceConfig, UtopiaTypeConfig }

/** The viewport range the scales are fluid across, in px. */
export interface UtopiaViewport {
  minWidth: number
  maxWidth: number
  /** What the fluid part of `clamp()` is relative to, as utopia-core-scss names it. */
  relativeTo: 'viewport-width' | 'container' | 'viewport'
}

export interface UtopiaConfig {
  viewport: UtopiaViewport
  type: UtopiaTypeConfig
  space: UtopiaSpaceConfig
}

const UTOPIA_KEYS = keysOf<UtopiaConfig>()('viewport', 'type', 'space')
const VIEWPORT_KEYS = keysOf<UtopiaViewport>()('minWidth', 'maxWidth', 'relativeTo')

/**
 * Checks that both scales use the viewport, and that it has no unknown or misspelt keys, and
 * returns the config.
 */
export function defineUtopia<const T extends UtopiaConfig>(
  config: T & Exactly<T, UtopiaConfig>,
): T {
  checkKeys('utopia', config, UTOPIA_KEYS)
  checkKeys('utopia.viewport', config.viewport, VIEWPORT_KEYS)
  for (const [name, scale] of [
    ['type', config.type],
    ['space', config.space],
  ] as const) {
    if (
      scale.minWidth !== config.viewport.minWidth ||
      scale.maxWidth !== config.viewport.maxWidth
    ) {
      throw new Error(
        `The ${name} scale runs from ${scale.minWidth}px to ${scale.maxWidth}px; the viewport is ${config.viewport.minWidth}px to ${config.viewport.maxWidth}px`,
      )
    }
  }
  return config
}
