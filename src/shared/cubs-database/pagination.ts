import type { PageViewQueryProjection, PageViewQueryScope } from './pageViewQueryContract'
import type { RowData } from './types'

export interface DatabasePageStream {
  scope: PageViewQueryScope
  rows: RowData[]
  total: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  isFetching: boolean
  error?: unknown
  beforeHeight: number
  afterHeight: number
}

/** Presentation-only bridge: membership, order and counts come from the API. */
export interface DatabasePagination {
  projection: PageViewQueryProjection | null
  streams: Record<string, DatabasePageStream>
  loadNext: (scope: PageViewQueryScope) => void
  loadPrevious: (scope: PageViewQueryScope) => void
  setScope: (scope: PageViewQueryScope) => void
  ensureScope: (scope: PageViewQueryScope) => void
  reportWindow?: (key: string, range: { firstId?: string; lastId?: string; height?: number; visible?: boolean }) => void
  pinRow?: (rowId: string, pinned: boolean) => void
  onInteractionChange?: (active: boolean) => void
  loading: boolean
  error?: unknown
  retry?: (scope?: PageViewQueryScope) => void
  deletedRowIds?: readonly string[]
  revoked?: boolean
  navigation?: Readonly<Record<string, { id: string; title: string; parentId: string }>>
  loadGroups?: () => void
}

export interface DatabaseRowMove {
  rowId: string
  beforeId?: string
  afterId?: string
  boundary?: 'start' | 'end'
}
