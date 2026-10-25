import { describe, expect, it } from 'vitest'
import { heatmapIntensity, heatmapWeeklyMaxima } from './heatmap'

describe('heatmap weekly scale', () => {
  it('maps the 10% cutoff to zero and the maximum to full intensity', () => {
    expect(heatmapIntensity(0, 0)).toBe(0)
    expect(heatmapIntensity(0, 13)).toBe(0)
    expect(heatmapIntensity(1, 13)).toBe(0)
    expect(heatmapIntensity(1.3, 13)).toBe(0)
    expect(heatmapIntensity(2, 13)).toBeCloseTo(0.059829)
    expect(heatmapIntensity(7, 13)).toBeCloseTo(0.487179)
    expect(heatmapIntensity(13, 13)).toBe(1)
  })
  it('shares the maximum across month boundaries and starts a new week on Sunday', () => {
    const maxima = heatmapWeeklyMaxima({
      '2026-10-31': { total: 3, checked: 3 },
      '2026-11-01': { total: 13, checked: 13 },
      '2026-11-07': { total: 2, checked: 2 },
      '2026-11-08': { total: 1, checked: 1 },
      '2026-12-31': { total: 7, checked: 7 },
      '2027-01-01': { total: 1, checked: 1 },
    })
    expect(maxima).toEqual({ '2026-10-31': 3, '2026-11-01': 13, '2026-11-07': 13, '2026-11-08': 1, '2026-12-31': 7, '2027-01-01': 7 })
  })
})
