import { formatDatePickerValue, parseDatePickerValue, type CalendarItem, type CalendarProperty } from 'cubs-components'
import type { ColumnDataType, HeaderCol, RowData } from './types'
import { formatCellValue, formatNumericValue, inferColumnType } from './utils'

export interface DatabaseCalendarProperty extends CalendarProperty {
  type: ColumnDataType
  value: string
  rawValue: unknown
  column: HeaderCol
}

export interface DatabaseCalendarItemTypes {
  page: {
    page: { id: string; title: string }
    properties?: DatabaseCalendarProperty[]
  }
}

type PropertyValueFormatter = (value: unknown, column: HeaderCol) => string | undefined

const mappedPropertyValues: Record<ColumnDataType, PropertyValueFormatter> = {
  text: (value) => formatCellValue(value),
  numeric: (value, column) => column.format ? formatNumericValue(value, column.format) : formatCellValue(value),
  date: (value) => formatDatePickerValue(value),
  checkbox: (value) => value ? 'Sim' : 'Não',
  select: (value, column) => typeof value === 'string'
    ? column.options?.find((option) => option.id === value)?.label
    : undefined,
  flow: () => undefined,
}

/** Read-only projection; the host persists the selected columns and their per-view order. */
export function databaseCalendarItems(rows: RowData[], columns: HeaderCol[], dateColumnId?: string, colorColumnId?: string | null, calendarPropertyIds?: string[]): CalendarItem<DatabaseCalendarItemTypes>[] {
  const dateColumn = dateColumnId ? columns.find((column) => column.id === dateColumnId && column.type === 'date') : columns.find((column) => column.type === 'date')
  if (!dateColumn) return []
  const titleColumn = columns.find((column) => column.key === 'title') ?? columns[0]
  // Column ids are the persisted ULIDs. An explicit id wins; otherwise the
  // first select column is the predictable default status/color source.
  const colorColumn = colorColumnId
    ? columns.find((column) => column.id === colorColumnId && column.type === 'select')
    : columns.find((column) => column.type === 'select')
  const propertyColumns = calendarPropertyIds === undefined
    ? columns.filter((column) => column.type !== 'flow')
    : calendarPropertyIds.flatMap((id) => {
        const column = columns.find((candidate) => candidate.id === id)
        return column && column.type !== 'flow' ? [column] : []
      })
  return rows.flatMap((row) => {
    const value = parseDatePickerValue(row.cells[dateColumn.id]?.value)
    if (!value) return []
    const title = String(row.cells[titleColumn?.id]?.value ?? 'Sem título')
    const properties: DatabaseCalendarProperty[] = propertyColumns.filter((column) => column.id !== titleColumn?.id && column.id !== dateColumn.id).flatMap((column) => {
      const raw = row.cells[column.id]?.value
      if (raw === undefined || raw === null || raw === '') return []
      const type = column.type ?? inferColumnType([raw])
      const display = mappedPropertyValues[type](raw, column)
      return display === undefined ? [] : [{
        id: column.id,
        label: column.title,
        type,
        value: display,
        rawValue: raw,
        column,
      }]
    })
    const allDay = !value.hasTime
    let end = value.end?.iso
    if (allDay) {
      // The date picker uses an inclusive final day; the calendar uses [start, end).
      const inclusive = new Date(value.end?.iso ?? value.start.iso)
      inclusive.setUTCDate(inclusive.getUTCDate() + 1)
      end = inclusive.toISOString()
    }
    const color = colorColumn?.options?.find((option) => option.id === row.cells[colorColumn.id]?.value)?.color ?? 'purple'
    return [{ id: row.id, type: 'page' as const, title, start: value.start.iso, end, allDay, color,
      data: { page: { id: row.id, title }, properties } }]
  })
}
