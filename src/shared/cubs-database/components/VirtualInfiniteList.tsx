import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { defaultRangeExtractor, useVirtualizer, useWindowVirtualizer, type Range } from '@tanstack/react-virtual'
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
  scrollMode?: 'internal' | 'page'
}

/** Keeps only the viewport mounted; evicted query windows retain their space. */
export function VirtualInfiniteList<T>({ items, itemKey, itemIds, renderItem, pagination, scope, stream,
  estimateSize = 80, gap = 0, pinnedIds = [], className, itemClassName, disabled = false, scrollMode = 'internal' }: VirtualInfiniteListProps<T>) {
  const viewport = useRef<HTMLDivElement>(null)
  const pageScroll = scrollMode === 'page'
  const [scrollTarget, setScrollTarget] = useState<HTMLElement | Window | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const hasScrolled = useRef(false)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [visibleWindow, setVisibleWindow] = useState(typeof IntersectionObserver === 'undefined')
  const scopeKey = pageViewScopeKey(scope)
  const { loadNext, loadPrevious, reportWindow, pinRow, onInteractionChange } = pagination
  useLayoutEffect(() => {
    if (!pageScroll || !viewport.current) return
    let ancestor = viewport.current.parentElement
    while (ancestor && !/^(auto|scroll|overlay)$/.test(getComputedStyle(ancestor).overflowY)) ancestor = ancestor.parentElement
    setScrollTarget(ancestor ?? window)
  }, [pageScroll])
  const measureMargin = useCallback(() => {
    if (!pageScroll || !scrollTarget || !viewport.current) return
    // The shared scroll offset includes content before this column's list.
    const top = viewport.current.getBoundingClientRect().top
    setScrollMargin(scrollTarget instanceof HTMLElement
      ? top - scrollTarget.getBoundingClientRect().top - scrollTarget.clientTop + scrollTarget.scrollTop
      : top + window.scrollY)
  }, [pageScroll, scrollTarget])
  useLayoutEffect(measureMargin)
  useEffect(() => {
    if (!pageScroll || !viewport.current) return
    const observer = new ResizeObserver(measureMargin)
    observer.observe(viewport.current)
    if (scrollTarget instanceof HTMLElement) observer.observe(scrollTarget)
    window.addEventListener('resize', measureMargin)
    return () => { observer.disconnect(); window.removeEventListener('resize', measureMargin) }
  }, [pageScroll, scrollTarget, measureMargin])
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
  const options = {
    count: items.length,
    getItemKey: (index: number) => itemKey(items[index]),
    estimateSize: () => estimateSize,
    gap,
    paddingStart: stream?.beforeHeight ?? 0,
    paddingEnd: stream?.afterHeight ?? 0,
    overscan: 5,
    rangeExtractor: (range: Range) => [...new Set([...defaultRangeExtractor(range), ...pinnedIndexes])].sort((a, b) => a - b),
    useFlushSync: false,
    scrollMargin: pageScroll ? scrollMargin : 0,
  }
  const elementVirtualizer = useVirtualizer({
    ...options,
    getScrollElement: () => pageScroll ? scrollTarget instanceof HTMLElement ? scrollTarget : null : viewport.current,
    enabled: !pageScroll || scrollTarget instanceof HTMLElement,
    initialOffset: () => pageScroll && scrollTarget instanceof HTMLElement ? scrollTarget.scrollTop : 0,
  })
  const windowVirtualizer = useWindowVirtualizer({ ...options, enabled: pageScroll && scrollTarget === window })
  const virtualizer = pageScroll && scrollTarget === window ? windowVirtualizer : elementVirtualizer
  // A status change can shorten a lane before the virtualizer measures again.
  const visible = virtualizer.getVirtualItems().filter((entry) => entry.index < items.length)
  // A pinned editor/drag item may be mounted far outside the viewport.
  // It must not turn every intervening row into a protected cache window.
  const first = virtualizer.range?.startIndex, last = virtualizer.range?.endIndex
  const totalHeight = virtualizer.getTotalSize()
  const load = useCallback(() => {
    if (!visibleWindow || disabled || stream?.isFetching || stream?.error || !hasScrolled.current) return
    const element = viewport.current
    if (!element) return
    const offset = pageScroll ? (virtualizer.scrollOffset ?? 0) - scrollMargin : element.scrollTop
    const height = pageScroll ? virtualizer.scrollRect?.height ?? 0 : element.clientHeight
    if (stream?.hasPreviousPage && offset < (stream.beforeHeight ?? 0) + 160) loadPrevious(scope)
    else if (stream?.hasNextPage && (last === undefined || last >= items.length - 3) && offset + height >= totalHeight - (stream.afterHeight ?? 0) - 240) loadNext(scope)
  }, [visibleWindow, disabled, stream, loadNext, loadPrevious, scope, last, items.length, totalHeight, pageScroll, virtualizer, scrollMargin])

  useEffect(() => {
    if (!pageScroll || !scrollTarget) return
    const onScroll = () => { hasScrolled.current = true; measureMargin(); load() }
    scrollTarget.addEventListener('scroll', onScroll, { passive: true })
    // A short first batch may fit on screen before the page can actually scroll.
    scrollTarget.addEventListener('wheel', onScroll, { passive: true })
    scrollTarget.addEventListener('touchmove', onScroll, { passive: true })
    return () => {
      scrollTarget.removeEventListener('scroll', onScroll)
      scrollTarget.removeEventListener('wheel', onScroll)
      scrollTarget.removeEventListener('touchmove', onScroll)
    }
  }, [pageScroll, scrollTarget, measureMargin, load])

  useEffect(load, [load])
  useEffect(() => {
    reportWindow?.(scopeKey, {
      firstId: first === undefined || first >= items.length ? undefined : itemKey(items[first]),
      lastId: last === undefined || last >= items.length ? undefined : itemKey(items[last]),
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

  return <div ref={viewport} data-infinite-list={scopeKey} className={cn('relative min-h-16', !pageScroll && 'max-h-[65dvh] overflow-y-auto overscroll-contain', className)}
    onScroll={pageScroll ? undefined : () => { hasScrolled.current = true; load() }}
    onWheel={pageScroll ? undefined : () => { hasScrolled.current = true; load() }}
    onTouchMove={pageScroll ? undefined : () => { hasScrolled.current = true; load() }}
    onFocusCapture={(event) => setFocusedId((event.target as HTMLElement).closest<HTMLElement>('[data-list-row]')?.dataset.listRow ?? null)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedId(null) }}>
    <div className="relative w-full" style={{ height: Math.max(1, totalHeight) }}>
      {visible.map((entry) => <div key={entry.key} ref={virtualizer.measureElement} data-index={entry.index} data-list-row={itemKey(items[entry.index])}
        className={cn('absolute left-0 top-0 w-full', itemClassName)} style={{ transform: `translateY(${entry.start - options.scrollMargin}px)` }}>
        {renderItem(items[entry.index], entry.index)}
      </div>)}
    </div>
    {(stream?.isFetching && !stream.isRefreshing) || (pagination.loading && !stream) ? <div role="status" className="flex justify-center py-2"><Icon icon="lucide:loader-circle" className="size-4 animate-spin opacity-50" /><span className="sr-only">Carregando páginas</span></div> : null}
    {stream?.error ? <button type="button" className="w-full px-3 py-2 text-xs text-p-red" onClick={() => pagination.retry ? pagination.retry(scope) : pagination.loadNext(scope)}>Não foi possível carregar. Tentar novamente</button> : null}
  </div>
}
