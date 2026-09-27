import { describe, expect, it } from 'vitest'

import { projectImageWidth } from './imageResize'

describe('projectImageWidth', () => {
  it('projects every pointer movement onto the image diagonal without rounding', () => {
    const width = projectImageWidth(560, 589.375, 73.4, 58.2, 872)

    expect(width).toBeCloseTo(623.89, 1)
    expect(Number.isInteger(width)).toBe(false)
  })

  it('respects the minimum and the available column width', () => {
    expect(projectImageWidth(560, 589.375, -2_000, -2_000, 872)).toBe(120)
    expect(projectImageWidth(560, 589.375, 2_000, 2_000, 872)).toBe(872)
  })
})
