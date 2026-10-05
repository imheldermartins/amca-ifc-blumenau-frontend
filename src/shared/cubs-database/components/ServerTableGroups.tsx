import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'
import type { DatabasePagination } from '../pagination'
import { pageViewScopeKey, type PageViewQueryGroup, type PageViewQueryScope } from '../pageViewQueryContract'
import type { HeaderCol, RowData } from '../types'
import { VirtualInfiniteList } from './VirtualInfiniteList'

const rowKey = (row: RowData) => row.id

function Branch({ group, columnsById, pagination, renderRow, depth = 0 }: {
  group: PageViewQueryGroup; columnsById: ReadonlyMap<string, HeaderCol>; pagination: DatabasePagination; renderRow: (row: RowData, depth: number) => ReactNode; depth?: number
}) {
  const [open, setOpen] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const scope = useMemo<PageViewQueryScope>(() => ({ type: 'group', path: group.path }), [group.path])
  const stream = pagination.streams[pageViewScopeKey(scope)]
  const projectionReady = Boolean(pagination.projection)
  const hasStream = Boolean(stream)
  const ensureScope = pagination.ensureScope
  const childrenCount = group.children?.length ?? 0
  const column = group.columnId ? columnsById.get(group.columnId) : undefined
  useEffect(() => {
    if (!projectionReady || !open || childrenCount || hasStream || !ref.current) return
    if (typeof IntersectionObserver === 'undefined') { ensureScope(scope); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) ensureScope(scope) })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [projectionReady, open, childrenCount, hasStream, scope, ensureScope])
  return <div ref={ref} role="group" data-group-key={group.key}>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}
      className="flex min-h-9 w-full min-w-max items-center gap-2 border-y border-divider bg-contrast pr-3 py-1 text-left text-sm transition-colors hover:bg-active"
      style={{ paddingLeft: 16 + depth * 18 }}>
      <span className="inline-flex items-center gap-1.5 rounded-md bg-p-purple px-2 py-1 font-semibold text-white">
        <Icon icon="lucide:chevron-right" className={cn('size-4 transition-transform', open && 'rotate-90')} />
        {column ? <span className="opacity-80">{column.title}:</span> : null}{group.label}
      </span>
      <span className="ml-auto rounded-full border border-divider bg-background px-2 py-0.5 text-xs">{group.total} {group.total === 1 ? 'linha' : 'linhas'}</span>
    </button>
    {open ? group.children?.length ? group.children.map((child) => <Branch key={child.key} group={child} columnsById={columnsById} pagination={pagination} renderRow={renderRow} depth={depth + 1} />)
      : <VirtualInfiniteList items={stream?.rows ?? []} itemKey={rowKey} renderItem={(row) => renderRow(row, depth + 1)}
        pagination={pagination} scope={scope} stream={stream} estimateSize={36} className="max-h-[55dvh]" /> : null}
  </div>
}

export function ServerTableGroups({ pagination, columns, renderRow }: {
  pagination: DatabasePagination; columns: HeaderCol[]; renderRow: (row: RowData, depth: number) => ReactNode
}) {
  const columnsById = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns])
  const continuation = useRef<HTMLDivElement>(null)
  const groupsCursor = pagination.projection?.groupsNextCursor
  const loadGroups = pagination.loadGroups
  useEffect(() => {
    if (!groupsCursor || !loadGroups || !continuation.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadGroups() })
    observer.observe(continuation.current)
    return () => observer.disconnect()
  }, [groupsCursor, loadGroups])
  return <>{pagination.projection?.groups?.map((group) => <Branch key={group.key} group={group} columnsById={columnsById} pagination={pagination} renderRow={renderRow} />)}
    {pagination.projection?.groupsNextCursor ? <div ref={continuation} role="status" className="py-2 text-center text-xs opacity-60">Carregando grupos</div> : null}
  </>
}
