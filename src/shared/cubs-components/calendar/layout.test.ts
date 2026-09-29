import { describe, expect, it } from 'vitest'
import type { CalendarInterval, CalendarItem } from './types'
import { calendarDays, flattenCalendarItems, intervalOf, isLongItem, layoutDaySegments, layoutTimeSegments, shiftCalendarDate, setCalendarYear } from './layout'

const event = (id: string, start: string, end?: string, allDay = false): CalendarInterval => ({ id, title: id, start, end, allDay })

describe('calendar periods and intervals', () => {
  it('includes leap day and complete weeks, including neighbouring months', () => {
    const days = calendarDays('2024-02-20', 'month', 1)
    expect(days[0]).toBe('2024-01-29')
    expect(days.at(-1)).toBe('2024-03-03')
    expect(days).toContain('2024-02-29')
    expect(days).toHaveLength(35)
    expect(calendarDays('2026-03-01', 'month', 1)).toHaveLength(42)
  })

  it('navigates year boundaries and clamps a day to the target month', () => {
    expect(shiftCalendarDate('2026-12-31', 1, 'month')).toBe('2027-01-31')
    expect(shiftCalendarDate('2024-01-31', 1, 'month')).toBe('2024-02-29')
    expect(shiftCalendarDate('2026-01-01', -1, 'day')).toBe('2025-12-31')
    expect(calendarDays('2026-01-01', 'week')[0]).toBe('2025-12-28')
  })

  it('supports distant years, including years before 100, and clamps leap day on year changes', () => {
    expect(calendarDays('0004-02-20', 'month')).toContain('0004-02-29')
    expect(calendarDays('0042-09-10', 'day')).toEqual(['0042-09-10'])
    expect(setCalendarYear('2024-02-29', 2025)).toBe('2025-02-28')
    expect(shiftCalendarDate('9999-12-15', 1, 'month')).toBe('9999-12-15')
  })

  it('renders one bar per week and excludes the exclusive ending day', () => {
    const item = event('range', '2026-09-04', '2026-09-10', true)
    const first = layoutDaySegments([item], calendarDays('2026-09-04', 'week', 1))
    const second = layoutDaySegments([item], calendarDays('2026-09-08', 'week', 1))
    expect(first).toMatchObject([{ column: 4, span: 3, continuesBefore: false, continuesAfter: true }])
    expect(second).toMatchObject([{ column: 0, span: 3, continuesBefore: true, continuesAfter: false }])
    expect(layoutDaySegments([item], ['2026-09-10'])).toEqual([])
  })

  it('packs intersecting ranges into lanes and reuses free lanes', () => {
    const segments = layoutDaySegments([
      event('a', '2026-09-07', '2026-09-10', true),
      event('b', '2026-09-08', '2026-09-09', true),
      event('c', '2026-09-10', '2026-09-11', true),
    ], calendarDays('2026-09-07', 'week'))
    expect(segments.map(({ lane }) => lane)).toEqual([0, 1, 0])
  })

  it('assigns equal widths to connected timed overlaps, resetting after the group', () => {
    const segments = layoutTimeSegments([
      event('a', '2026-09-27T09:00:00Z', '2026-09-27T11:00:00Z'),
      event('b', '2026-09-27T10:00:00Z', '2026-09-27T12:00:00Z'),
      event('c', '2026-09-27T11:00:00Z', '2026-09-27T13:00:00Z'),
      event('d', '2026-09-27T13:00:00Z', '2026-09-27T14:00:00Z'),
    ], '2026-09-27')
    expect(segments.map(({ column, columnCount }) => [column, columnCount])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]])
    expect(segments[0]).toMatchObject({ startMinute: 540, endMinute: 660 })
  })

  it('keeps UTC display times stable and midnight exclusive', () => {
    const midnight = event('midnight', '2026-03-08T23:00:00Z', '2026-03-09T00:00:00Z')
    expect(isLongItem(midnight)).toBe(false)
    expect(layoutTimeSegments([midnight], '2026-03-08')[0]).toMatchObject({ startMinute: 1380, endMinute: 1440 })
    expect(layoutTimeSegments([midnight], '2026-03-09')).toEqual([])
    expect(isLongItem(event('overnight', midnight.start, '2026-03-09T01:00:00Z'))).toBe(true)
  })

  it('omits invalid or reversed intervals and supplies single-item durations', () => {
    expect(layoutDaySegments([event('bad', 'bad'), event('reverse', '2026-09-10', '2026-09-09')], ['2026-09-10'])).toEqual([])
    const single = intervalOf(event('time', '2026-09-10T09:00:00Z'))
    expect(single.end.diff(single.start, 'minute')).toBe(30)
    const allDay = intervalOf(event('day', '2026-09-10', undefined, true))
    expect(allDay.end.diff(allDay.start, 'day')).toBe(1)
  })

  it('recursively lists typed child items without losing payloads', () => {
    const child: CalendarItem = { ...event('child', '2026-09-02'), type: 'item', data: { properties: [] } }
    const parent: CalendarItem = { ...event('parent', '2026-09-01'), type: 'page', data: { page: { id: 'page', title: 'Page' } }, children: [child] }
    expect(flattenCalendarItems([parent])).toEqual([parent, child])
  })
})
