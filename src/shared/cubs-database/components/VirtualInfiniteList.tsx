import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'
import type { DatabasePageStream, DatabasePagination } from '../pagination'
import { pageViewScopeKey, type PageViewQueryScope } from '../pageViewQueryContract'

export interface VirtualInfiniteListProps<T> {
  items: readonly T[]
  itemKey: (item: T) => string
  itemIds?: (item: T) => readonly string[]
  renderItem: (item: T, index: number) => ReactNode
  pagination: DatabasePagination
  scope: PageViewQueryScope
  stream?: DatabasePageStream
  estimateSize?: number
  gap?: number
  pinnedIds?: readonly string[]
  className?: string
  itemClassName?: string
  disabled?: boolean
}

/** Keeps only the viewport mounted; evicted query windows retain their space. */
export function VirtualInfiniteList<T>({ items, itemKey, itemIds, renderItem, pagination, scope, stream,
  estimateSize = 80, gap = 0, pinnedIds = [], className, itemClassName, disabled = false }: VirtualInfiniteListProps<T>) {
  const viewport = useRef<HTMLDivElement>(null)
  const hasScrolled = useRef(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [visibleWindow, setVisibleWindow] = useState(typeof IntersectionObserver === 'undefined')
  const scopeKey = pageViewScopeKey(scope)
  const { loadNext, loadPrevious, reportWindow, pinRow, onInteractionChange } = pagination
  useEffect(() => {
    if (!viewport.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setVisibleWindow(entry.isIntersecting))
    observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  const pinnedIndexes = useMemo(() => items.flatMap((item, index) => {
    const ids = itemIds ? itemIds(item) : [itemKey(item)]
    return ids.some((id) => pinnedIds.includes(id) || focusedId === id) ? [index] : []
  }), [items, itemKey, itemIds, pinnedIds, focusedId])
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewport.current,
    getItemKey: (index) => itemKey(items[index]),
    estimateSize: () => estimateSize,
    gap,
    paddingStart: stream?.beforeHeight ?? 0,
    paddingEnd: stream?.afterHeight ?? 0,
    overscan: 5,
    rangeExtractor: (range) => [...new Set([...defaultRangeExtractor(range), ...pinnedIndexes])].sort((a, b) => a - b),
    useFlushSync: false,
  })
  const visible = virtualizer.getVirtualItems()
  // A pinned editor/drag item may be mounted far outside the viewport.
  // It must not turn every intervening row into a protected cache window.
  const first = virtualizer.range?.startIndex, last = virtualizer.range?.endIndex
  const totalHeight = virtualizer.getTotalSize()
  const load = useCallback(() => {
    if (!visibleWindow || disabled || stream?.isFetching || stream?.error || !hasScrolled.current) return
    const element = viewport.current
    if (!element) return
    if (stream?.hasPreviousPage && element.scrollTop < (stream.beforeHeight ?? 0) + 160) loadPrevious(scope)
    else if (stream?.hasNextPage && (last === undefined || last >= items.length - 3) && element.scrollTop + element.clientHeight >= totalHeight - (stream.afterHeight ?? 0) - 240) loadNext(scope)
  }, [visibleWindow, disabled, stream, loadNext, loadPrevious, scope, last, items.length, totalHeight])

  useEffect(load, [load])
  useEffect(() => {
    reportWindow?.(scopeKey, {
      firstId: first === undefined ? undefined : itemKey(items[first]),
      lastId: last === undefined ? undefined : itemKey(items[last]),
      height: totalHeight - (stream?.beforeHeight ?? 0) - (stream?.afterHeight ?? 0),
      visible: visibleWindow,
    })
  }, [reportWindow, scopeKey, first, last, items, itemKey, totalHeight, stream?.beforeHeight, stream?.afterHeight, visibleWindow])
  useEffect(() => () => reportWindow?.(scopeKey, { visible: false }), [reportWindow, scopeKey])
  useEffect(() => {
    // Removing a focused DOM node does not fire blur in every browser. A
    // realtime deletion must still release the editor's cache/interaction pin.
    if (focusedId && !items.some((item) => (itemIds ? itemIds(item) : [itemKey(item)]).includes(focusedId))) setFocusedId(null)
  }, [focusedId, items, itemIds, itemKey])
  useEffect(() => {
    if (!focusedId) return
    pinRow?.(focusedId, true)
    onInteractionChange?.(true)
    return () => { pinRow?.(focusedId, false); onInteractionChange?.(false) }
  }, [focusedId, pinRow, onInteractionChange])

  return <div ref={viewport} data-infinite-list={scopeKey} className={cn('relative min-h-16 max-h-[65dvh] overflow-y-auto overscroll-contain', className)}
    onScroll={() => { hasScrolled.current = true; load() }}
    onWheel={() => { hasScrolled.current = true; load() }}
    onTouchMove={() => { hasScrolled.current = true; load() }}
    onFocusCapture={(event) => setFocusedId((event.target as HTMLElement).closest<HTMLElement>('[data-list-row]')?.dataset.listRow ?? null)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedId(null) }}>
    <div className="relative w-full" style={{ height: Math.max(1, totalHeight) }}>
      {visible.map((entry) => <div key={entry.key} ref={virtualizer.measureElement} data-index={entry.index} data-list-row={itemKey(items[entry.index])}
        className={cn('absolute left-0 top-0 w-full', itemClassName)} style={{ transform: `translateY(${entry.start}px)` }}>
        {renderItem(items[entry.index], entry.index)}
      </div>)}
    </div>
    {stream?.isFetching || (pagination.loading && !stream) ? <div role="status" className="flex justify-center py-2"><Icon icon="lucide:loader-circle" className="size-4 animate-spin opacity-50" /><span className="sr-only">Carregando páginas</span></div> : null}
    {stream?.error ? <button type="button" className="w-full px-3 py-2 text-xs text-p-red" onClick={() => pagination.retry ? pagination.retry(scope) : pagination.loadNext(scope)}>Não foi possível carregar. Tentar novamente</button> : null}
  </div>
}
