import { databaseCalendarItems } from './calendarItems'
import { parseDatePickerValue } from 'cubs-components'
import type { HeaderCol, RowData } from './types'

export const TIMELINE_DAY_MS = 86_400_000
export type TimelineScale = 'week' | 'month'

export function timelinePeriod(date: string, scale: TimelineScale) {
  const start = new Date(`${date}T00:00:00.000Z`)
  if (scale === 'month') start.setUTCDate(1)
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7)
  const end = new Date(start)
  if (scale === 'month') end.setUTCMonth(end.getUTCMonth() + 1)
  else end.setUTCDate(end.getUTCDate() + 7)
  const days = Array.from({ length: Math.round((+end - +start) / TIMELINE_DAY_MS) }, (_, i) => new Date(+start + i * TIMELINE_DAY_MS).toISOString().slice(0, 10))
  return { start: +start, end: +end, days, from: days[0], to: days.at(-1)! }
}

export function timelineItems(rows: RowData[], columns: HeaderCol[], dateColumnId?: string, colorColumnId?: string | null) {
  const dateColumn = dateColumnId ? columns.find(c => c.id === dateColumnId && c.type === 'date') : columns.find(c => c.type === 'date')
  const validRows = dateColumn ? rows.filter(row => {
    const value = parseDatePickerValue(row.cells[dateColumn.id]?.value)
    return value && (!value.end || value.end.iso >= value.start.iso)
  }) : []
  return databaseCalendarItems(validRows, columns, dateColumnId, colorColumnId, []).flatMap(item => {
    const start = Date.parse(item.start)
    const end = item.end ? Date.parse(item.end) : start
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return []
    return [{ ...item, color: colorColumnId ? item.color : 'purple' as const, startMs: start, endMs: end }]
  })
}

export function timelineBar(start: number, end: number, period: {start: number; end: number}, dayWidth: number) {
  if (start >= period.end || (end > start ? end <= period.start : start < period.start)) return null
  const left = (Math.max(start, period.start) - period.start) / TIMELINE_DAY_MS * dayWidth
  const right = (Math.min(end, period.end) - period.start) / TIMELINE_DAY_MS * dayWidth
  const available = (period.end - period.start) / TIMELINE_DAY_MS * dayWidth - left
  return { left, width: Math.min(available, Math.max(8, right - left)) }
}
