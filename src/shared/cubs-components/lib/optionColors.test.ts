import { describe, expect, it } from 'vitest'

import { OPTION_COLOR_CLASSES, OPTION_COLORS, OPTION_COLOR_SWATCH } from './optionColors'
import { PALETTE, PALETTE_COLORS } from './palette'

const REQUESTED_COLORS = ['green', 'pink', 'orange', 'purple'] as const

describe('paletas compartilhadas', () => {
  it('oferece as novas cores no picker e nos chips', () => {
    expect(OPTION_COLORS).toEqual(expect.arrayContaining([...REQUESTED_COLORS]))

    for (const color of REQUESTED_COLORS) {
      expect(OPTION_COLOR_CLASSES[color]).toContain(`bg-p-${color}`)
      expect(OPTION_COLOR_SWATCH[color]).toBe(`bg-p-${color}-500`)
    }
  })

  it('oferece green, pink, orange e purple aos componentes de cor dinâmica', () => {
    expect(PALETTE_COLORS).toEqual(expect.arrayContaining([...REQUESTED_COLORS]))

    for (const color of REQUESTED_COLORS) {
      expect(PALETTE[color].bg).toBe(`bg-p-${color}-500`)
      expect(PALETTE[color].text).toContain(`text-p-${color}`)
    }
  })
})
