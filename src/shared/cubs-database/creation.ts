import type {CalendarCreateSelection} from 'cubs-components'
import type {DataViewKind} from './types'

/** Hosts can opt additional view types into the same modal without changing +. */
export const MODAL_CREATE_VIEW_TYPES: Readonly<Partial<Record<DataViewKind, true>>> = {calendar: true}

export interface DatabaseCreateRequest {
  viewType: DataViewKind
  viewId: string
  dateColumnId?: string
  initialValues?: Record<string, unknown>
  selection?: CalendarCreateSelection
}

export function calendarSelectionValue(selection: CalendarCreateSelection): string {
  const start = new Date(`${selection.day}T00:00:00.000Z`)
  if (selection.allDay) return start.toISOString()
  start.setUTCMinutes(selection.minute ?? 0)
  const end = new Date(start.getTime() + 30 * 60_000)
  return `${start.toISOString()}@${end.toISOString()}`
}
