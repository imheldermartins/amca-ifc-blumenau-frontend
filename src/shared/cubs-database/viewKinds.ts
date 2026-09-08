import type { DataViewKind } from './types'

/** Ordem única usada pelo seletor, parser e demais superfícies da database. */
export const DATA_VIEW_KINDS = [
  'table',
  'grid',
  'board',
  'calendar',
  'timeline',
  'graph',
] as const satisfies readonly DataViewKind[]

export const VIEW_KIND_ICON: Record<DataViewKind, string> = {
  table: 'lucide:table-2',
  grid: 'lucide:grid-2x2',
  board: 'lucide:kanban',
  calendar: 'lucide:calendar-days',
  timeline: 'lucide:gantt-chart',
  graph: 'lucide:network',
}

export function isDataViewKind(value: unknown): value is DataViewKind {
  return DATA_VIEW_KINDS.includes(value as DataViewKind)
}
