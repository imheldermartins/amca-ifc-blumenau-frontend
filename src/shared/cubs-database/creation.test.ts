import {describe, expect, it} from 'vitest'
import {calendarSelectionValue, MODAL_CREATE_VIEW_TYPES} from './creation'

describe('calendar creation context', () => {
  it('only opts Calendar into modal creation', () => {expect(MODAL_CREATE_VIEW_TYPES).toEqual({calendar: true})})
  it('preserves a civil day without browser timezone conversion', () => {
    expect(calendarSelectionValue({day: '2026-10-27', allDay: true})).toBe('2026-10-27T00:00:00.000Z')
  })
  it('carries a half-hour slot, including midnight and the end of the day', () => {
    expect(calendarSelectionValue({day: '2026-10-27', allDay: false, minute: 0})).toBe('2026-10-27T00:00:00.000Z@2026-10-27T00:30:00.000Z')
    expect(calendarSelectionValue({day: '2026-10-27', allDay: false, minute: 1410})).toBe('2026-10-27T23:30:00.000Z@2026-10-28T00:00:00.000Z')
  })
})
