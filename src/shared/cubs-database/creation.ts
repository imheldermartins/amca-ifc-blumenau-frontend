import type {CalendarCreateSelection} from 'cubs-components'
import type {DataViewKind} from './types'

/** Graph, Timeline and Calendar share the modal creation controller. */
export const MODAL_CREATE_VIEW_TYPES: Readonly<Partial<Record<DataViewKind, true>>> = {graph: true, timeline: true, calendar: true}

export interface DatabaseCreateRequest {
  viewType: DataViewKind
  viewId: string
  /** Graph's inline + creates inside this node instead of the outer database. */
  parentPageId?: string
  destinationLabel?: string
  dateColumnId?: string
  initialValues?: Record<string, unknown>
  selection?: CalendarCreateSelection
}

/** Page clicks share a modal host; Graph supplies each node's immediate parent. */
export interface DatabaseEditRequest {
  viewType: 'graph' | 'timeline' | 'calendar'
  viewId?: string
  rowId: string
  parentPageId: string
  destinationLabel?: string
  dateColumnId?: string
}

export function calendarSelectionValue(selection: CalendarCreateSelection): string {
  const start = new Date(`${selection.day}T00:00:00.000Z`)
  if (selection.allDay) return start.toISOString()
  start.setUTCMinutes(selection.minute ?? 0)
  const end = new Date(start.getTime() + 30 * 60_000)
  return `${start.toISOString()}@${end.toISOString()}`
}
