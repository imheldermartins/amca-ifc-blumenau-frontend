import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import type { CalendarInterval, CalendarItem, CalendarMode } from './types'

dayjs.extend(utc)
export const calendarDate = (value: string) => {
  const parsed = dayjs.utc(value)
  // JS Date.UTC treats years 00–99 as 1900–1999; restore the explicit ISO year.
  return /^00\d{2}-/.test(value) ? parsed.year(Number(value.slice(0, 4))) : parsed
}

export function startOfCalendarWeek(date: string, weekStartsOn: 0 | 1 = 0) {
  const day = calendarDate(date).startOf('day')
  return day.subtract((day.day() - weekStartsOn + 7) % 7, 'day')
}

export function calendarDays(date: string, mode: CalendarMode, weekStartsOn: 0 | 1 = 0) {
  const day = calendarDate(date).startOf('day')
  const start = mode === 'day' ? day : startOfCalendarWeek(
    (mode === 'month' ? day.date(1) : day).format('YYYY-MM-DD'), weekStartsOn,
  )
  const count = mode === 'month'
    ? Math.ceil((day.date(day.daysInMonth()).diff(start, 'day') + 1) / 7) * 7
    : mode === 'week' ? 7 : 1
  return Array.from({ length: count }, (_, index) => start.add(index, 'day').format('YYYY-MM-DD'))
}

export function intervalOf(item: CalendarInterval) {
  const start = calendarDate(item.start)
  const end = item.end ? calendarDate(item.end) : start.add(1, 'day')
  const resolvedEnd = !item.end && !item.allDay ? start.add(30, 'minute') : end
  return { start, end: resolvedEnd, valid: start.isValid() && resolvedEnd.isValid() && resolvedEnd.isAfter(start) }
}

export function flattenCalendarItems<M extends object>(items: CalendarItem<M>[]): CalendarItem<M>[] {
  return items.flatMap((item) => [item, ...flattenCalendarItems(item.children ?? [])])
}

export function isLongItem(item: CalendarInterval) {
  const { start, end } = intervalOf(item)
  return Boolean(item.allDay) || !start.isSame(end.subtract(1, 'millisecond'), 'day')
}

export interface DaySegment<T> {
  item: T
  column: number
  span: number
  lane: number
  continuesBefore: boolean
  continuesAfter: boolean
}

/** One bar per item per visible week, packed into non-overlapping lanes. */
export function layoutDaySegments<T extends CalendarInterval>(items: T[], days: string[]): DaySegment<T>[] {
  if (!days.length) return []
  const rangeStart = calendarDate(days[0])
  const rangeEnd = calendarDate(days[days.length - 1]).add(1, 'day')
  const segments = items.flatMap((item) => {
    const { start, end, valid } = intervalOf(item)
    if (!valid || !start.isBefore(rangeEnd) || !end.isAfter(rangeStart)) return []
    const column = Math.max(0, start.startOf('day').diff(rangeStart, 'day'))
    const last = Math.min(days.length - 1, end.subtract(1, 'millisecond').startOf('day').diff(rangeStart, 'day'))
    return [{ item, column, span: last - column + 1, lane: 0,
      continuesBefore: start.isBefore(rangeStart), continuesAfter: end.isAfter(rangeEnd) }]
  }).sort((a, b) => a.column - b.column || b.span - a.span || a.item.start.localeCompare(b.item.start) || a.item.id.localeCompare(b.item.id))
  const laneEnds: number[] = []
  for (const segment of segments) {
    let lane = laneEnds.findIndex((end) => end <= segment.column)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = segment.column + segment.span
    segment.lane = lane
  }
  return segments
}

export interface TimeSegment<T> {
  item: T
  startMinute: number
  endMinute: number
  column: number
  columnCount: number
}

/** Connected overlap groups share their maximum number of simultaneous lanes. */
export function layoutTimeSegments<T extends CalendarInterval>(items: T[], date: string): TimeSegment<T>[] {
  const day = calendarDate(date).startOf('day')
  const next = day.add(1, 'day')
  const segments = items.flatMap((item) => {
    const { start, end, valid } = intervalOf(item)
    if (!valid || !start.isBefore(next) || !end.isAfter(day)) return []
    return [{ item, startMinute: Math.max(0, start.diff(day, 'minute', true)),
      endMinute: Math.min(1440, end.diff(day, 'minute', true)), column: 0, columnCount: 1 }]
  }).sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute)
  let group: TimeSegment<T>[] = []
  let ends: number[] = []
  let groupEnd = -1
  const finishGroup = () => group.forEach((segment) => { segment.columnCount = ends.length })
  for (const segment of segments) {
    if (segment.startMinute >= groupEnd) {
      finishGroup()
      group = []
      ends = []
      groupEnd = -1
    }
    let column = ends.findIndex((end) => end <= segment.startMinute)
    if (column === -1) column = ends.length
    ends[column] = segment.endMinute
    segment.column = column
    group.push(segment)
    groupEnd = Math.max(groupEnd, segment.endMinute)
  }
  finishGroup()
  return segments
}

export function shiftCalendarDate(date: string, amount: number, mode: CalendarMode) {
  const next = calendarDate(date).add(amount, mode)
  return next.year() < 1 || next.year() > 9999 ? date : next.format('YYYY-MM-DD')
}

export function setCalendarYear(date: string, year: number) {
  return calendarDate(date).year(year).format('YYYY-MM-DD')
}

export function formatCalendarDate(date: string, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(calendarDate(date).toDate())
}
