import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import type { DatabasePagination, DataViewType, HeaderCol, RowData, ViewFiltersV2 } from 'cubs-database'
import type { DatabaseRealtimeEvent } from '@/lib/databaseRealtime'
import { parseRows, TITLE_COLUMN_ID } from '@/lib/databaseParser'
import { databaseService } from '@/services/DatabaseService'
import { PageRealtimeChannel, type PageStructureEvent } from '@/services/PageRealtimeChannel'
import { useSocket } from '@/hooks/useSocket'
import type { RowOrderUpdatedPayload } from '@/services/realtime-contract-v1'
import { pageViewScopeKey, type PageViewQueryProjection, type PageViewQueryRequest, type PageViewQueryScope } from '@/shared/cubs-database/pageViewQueryContract'
import { mergeDatabaseGroups, refreshDatabaseGroups, mergeDatabaseWindow, shareDatabaseRows, trimDatabaseWindows, type CachedDatabaseWindow, type WindowViewport } from '@/lib/databaseWindowCache'

export interface DatabaseProjectionBridge {
  onEvent(event: DatabaseRealtimeEvent): void
  onStructure(event: PageStructureEvent): void
  onResync(): void
  onAccessDenied(): void
  onRowOrder(payload: RowOrderUpdatedPayload): void
  onLocalRows(rows: RowData[]): void
  onCreatedRow(row: RowData): void
  orderRevision: number
}
interface PaginationOptions {
  pageId: string; viewId: string; view?: DataViewType; columns?: HeaderCol[]
  filters: ViewFiltersV2; enabled: boolean; onRows(rows: RowData[]): void
}
interface FetchParam extends PageViewQueryRequest { replaceId?: number; recovery?: boolean }
interface FetchEnvelope { projection: PageViewQueryProjection; param: FetchParam; generation: number; identity: string }
interface CreatedRow { row: RowData; scope: PageViewQueryScope; wasPinned: boolean }
interface Failure { param: FetchParam; error: unknown }
interface CacheState {
  projection: PageViewQueryProjection | null; windows: CachedDatabaseWindow[]
  gaps: Record<string, { before: number; after: number }>
  created: Record<string, CreatedRow>; failures: Record<string, Failure>
  deletedRowIds: string[]
  navigation: Record<string, { id: string; title: string; parentId: string }>
}
const EMPTY_CACHE: CacheState = { projection: null, windows: [], gaps: {}, created: {}, failures: {}, deletedRowIds: [], navigation: {} }
const ROOT: PageViewQueryScope = { type: 'root' }
interface Session {
  identity: string; owner: string; cache: CacheState; generation: number; denied: boolean
  queue: FetchParam[]; active: FetchParam | null; next: FetchParam | undefined; running: boolean
  consumed: FetchEnvelope | null; completed: Map<string, string>
  pins: Map<string, number>; viewports: Map<string, WindowViewport>; averageHeight: Map<string, number>
  clocks: Map<string, string>; interactions: number; dirty: boolean; timer?: ReturnType<typeof setTimeout>
  revokedBranches: Set<string>
}
const newSession = (identity: string, owner: string): Session => ({ identity, owner, cache: EMPTY_CACHE, generation: 0, denied: false, queue: [], active: null, next: undefined, running: false, consumed: null, completed: new Map(), pins: new Map(), viewports: new Map(), averageHeight: new Map(), clocks: new Map(), interactions: 0, dirty: false, revokedBranches: new Set() })
const requestKey = (param: FetchParam) => JSON.stringify(param)
const streamKey = (param: FetchParam) => pageViewScopeKey(param.scope ?? ROOT)
const sameCells = (one: RowData, two: RowData) => one === two || JSON.stringify(one.cells) === JSON.stringify(two.cells)

/** One transport, bounded view-wide cache, and independently scrollable streams. */
export function useDatabasePagination(options: PaginationOptions): { pagination: DatabasePagination; bridge: DatabaseProjectionBridge; error: unknown } {
  const client = useQueryClient()
  const owner = JSON.stringify([options.pageId, options.viewId, options.view?.view])
  const [requestedScope, updateScope] = useState<{ owner: string; scope: PageViewQueryScope }>({ owner, scope: ROOT })
  // Calendar's period belongs to that view. Changing views starts at root on
  // the very first request, before cleanup effects from the previous owner.
  const scope = options.view?.view === 'calendar' && requestedScope.owner === owner ? requestedScope.scope : ROOT
  const enabled = options.enabled && Boolean(options.viewId) && options.view?.view !== 'form' && options.view?.view !== 'timeline'
  // Display preferences and filter ACK timestamps don't change SQL membership.
  // Every HTTP request still carries the full filter document.
  const identity = JSON.stringify([owner, enabled, options.filters.clauses, options.view?.view === 'board' ? [] : options.filters.groupBy, options.view?.board?.selectColumnId, options.view?.dateColumnId, scope])
  const sessionRef = useRef<Session>(newSession(identity, owner))
  if (sessionRef.current.identity !== identity) {
    const previous = sessionRef.current, next = newSession(identity, owner)
    if (enabled && previous.owner === owner && !previous.denied) {
      // A filter change starts a new SQL projection, while the page currently
      // being created remains editable until the editor's final unpin.
      next.cache = { ...EMPTY_CACHE, created: previous.cache.created }
      next.pins = new Map([...previous.pins].filter(([id]) => previous.cache.created[id]))
      next.interactions = Object.keys(previous.cache.created).length ? previous.interactions : 0
      next.clocks = new Map(previous.clocks)
      next.revokedBranches = new Set(previous.revokedBranches)
    }
    sessionRef.current = next
  }
  const session = sessionRef.current
  const [, renderCache] = useState<CacheState>(EMPTY_CACHE)
  const cache = session.cache
  const optionsRef = useRef(options); optionsRef.current = options
  const enabledRef = useRef(enabled); enabledRef.current = enabled
  const key = useMemo(() => ['database-projection', identity] as const, [identity])
  const keyRef = useRef(key); keyRef.current = key
  const scopeRef = useRef(scope); scopeRef.current = scope
  const ownerRef = useRef(owner); ownerRef.current = owner
  const { socket } = useSocket(enabled && options.view?.view === 'graph')
  const nextId = useRef(0)
  const pumpRef = useRef<() => void>(() => undefined)
  const reconcileRef = useRef<() => void>(() => undefined)
  const applyRef = useRef<(response?: FetchEnvelope) => void>(() => undefined)
  const commit = useCallback((current: Session, next: CacheState) => {
    if (current !== sessionRef.current || current.denied) return
    // Scroll callbacks may run before React's next render. Publish atomically.
    current.cache = next; renderCache(next)
  }, [])
  const initialParam: FetchParam = { scope, limit: 50 }
  if (options.view?.view === 'board') {
    const board = options.view.board
    const column = board?.selectColumnId ? options.columns?.find((column) => column.id === board.selectColumnId && column.type === 'select') : options.columns?.find((column) => column.type === 'select')
    const ids = [...(column?.options?.map((option) => option.id) ?? []), '__unassigned__']
    const order = [...new Set([...(board?.optionOrder ?? []).filter((id) => ids.includes(id)), ...ids])]
    const count = Math.max(1, Math.ceil(((typeof window === 'undefined' ? 1280 : window.innerWidth) - 280) / 332))
    initialParam.visibleGroupKeys = order.filter((id) => !board?.collapsedOptionIds?.includes(id)).slice(0, count).map((id) => `board:${id}`)
  }
  const initialRef = useRef(initialParam); initialRef.current = initialParam
  const query = useInfiniteQuery({
    queryKey: key, initialPageParam: initialParam,
    queryFn: async ({ pageParam, signal }): Promise<FetchEnvelope> => {
      const atStart = session.generation
      const { replaceId: _replaceId, recovery: _recovery, ...input } = pageParam
      const projection = await databaseService.queryView(options.pageId, options.viewId, { ...input, filters: optionsRef.current.filters, limit: input.limit ?? 50 }, signal)
      return { projection, param: pageParam, generation: atStart, identity }
    },
    getNextPageParam: () => session.next, getPreviousPageParam: () => undefined,
    maxPages: 1, // Transport never becomes a second unbounded row cache.
    enabled: enabled && !session.denied, retry: false, staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false,
  })
  const queryRef = useRef(query); queryRef.current = query
  const deny = useCallback(() => {
    const current = sessionRef.current
    current.denied = true; current.generation++; current.queue = []; current.active = null
    if (current.timer) clearTimeout(current.timer)
    current.cache = EMPTY_CACHE; current.pins.clear(); current.clocks.clear()
    renderCache(EMPTY_CACHE); optionsRef.current.onRows([])
    void client.cancelQueries({ queryKey: keyRef.current }); client.removeQueries({ queryKey: keyRef.current })
  }, [client])
  const fail = useCallback((current: Session, param: FetchParam, error: unknown) => {
    if (current !== sessionRef.current || current.denied) return
    commit(current, { ...current.cache, failures: { ...current.cache.failures, [streamKey(param)]: { param, error } } })
  }, [commit])
  const enqueue = useCallback((param: FetchParam) => {
    const current = sessionRef.current
    if (current.denied || !enabledRef.current || current.cache.failures[streamKey(param)] || (param.scope?.type === 'graph' && current.revokedBranches.has(param.scope.parentId))) return
    const id = requestKey(param)
    if (requestKey(current.active ?? {}) !== id && !current.queue.some((entry) => requestKey(entry) === id)) current.queue.push(param)
    pumpRef.current()
  }, [])
  pumpRef.current = () => {
    const current = sessionRef.current
    if (current.running || queryRef.current.isFetching || !current.queue.length || current.denied || !enabledRef.current) return
    const param = current.queue.shift()!
    current.next = param; current.active = param; current.running = true
    void queryRef.current.fetchNextPage({ cancelRefetch: false }).then((result) => {
      if (current !== sessionRef.current || current.denied) return
      if (result.error) {
        const status = (result.error as { status?: number }).status
        if (status === 403) deny()
        else if (status === 409 && !param.recovery) current.queue.unshift({ scope: param.scope, anchorId: current.cache.windows.find((window) => window.id === param.replaceId)?.rows[0]?.id, replaceId: param.replaceId, limit: 50, recovery: true })
        else fail(current, param, result.error)
      } else applyRef.current(result.data?.pages.at(-1))
    }).finally(() => {
      if (current !== sessionRef.current || current.denied) return
      current.running = false; current.active = null; current.next = undefined
      if (current.dirty && !current.interactions && !current.timer) { current.dirty = false; reconcileRef.current() }
      pumpRef.current()
    })
  }
  reconcileRef.current = () => {
    const current = sessionRef.current
    if (current.denied || !enabledRef.current) return
    if (current.interactions || current.running || queryRef.current.isFetching) { current.dirty = true; return }
    const windows = current.cache.windows
    if (!windows.length) {
      if (current.cache.failures[pageViewScopeKey(scopeRef.current)]) return
      if (queryRef.current.data) enqueue(initialRef.current)
      else void queryRef.current.refetch()
      return
    }
    if (optionsRef.current.view?.view === 'table' && optionsRef.current.filters.groupBy.length) enqueue({ scope: ROOT, metadataOnly: true })
    for (const window of windows) enqueue({ scope: window.scope, anchorId: window.rows[0]?.id, replaceId: window.id, limit: Math.max(1, window.rows.length) })
  }
  const invalidate = useCallback(() => {
    const current = sessionRef.current
    if (current.denied || !enabledRef.current) return
    current.generation++; current.completed.clear(); current.dirty = true
    // The first fact starts the coalescing window. A continuous stream must
    // still refresh counts; restarting a trailing debounce would starve it.
    if (current.timer) return
    current.timer = setTimeout(() => {
      current.timer = undefined
      if (current !== sessionRef.current || current.running || current.interactions || queryRef.current.isFetching) return
      current.dirty = false; reconcileRef.current()
    }, 200)
  }, [])
  applyRef.current = (response) => {
    const current = sessionRef.current
    if (!response || current.denied || response === current.consumed || response.identity !== current.identity) return
    current.consumed = response
    if (response.generation !== current.generation) { current.dirty = true; return }
    const { projection, param } = response, before = current.cache
    if (param.scope?.type === 'graph' && current.revokedBranches.has(param.scope.parentId)) return
    const previous = new Map(before.windows.flatMap((window) => window.rows.map((row) => [row.id, row] as const)))
    for (const entry of Object.values(before.created)) previous.set(entry.row.id, entry.row)
    let windows = before.windows
    for (const window of projection.windows) {
      const rows = shareDatabaseRows(parseRows(window.rows), previous).map((row) => before.created[row.id]?.row ?? row)
      const incoming: CachedDatabaseWindow = { ...window, rows, id: param.replaceId ?? ++nextId.current }
      windows = mergeDatabaseWindow(windows, incoming, param.direction ?? 'next', param.replaceId)
    }
    const protectedRows = new Set([...current.pins.keys(), ...projection.windows.flatMap((window) => window.rows.map((row) => row.page_id))])
    const trimmed = trimDatabaseWindows(windows, current.viewports, protectedRows)
    // Keep only the titles/edges needed to reach retained Graph branches.
    // Protecting an entire 50-row ancestor batch per depth would defeat the cap.
    const navigation: CacheState['navigation'] = {}
    if (projection.kind === 'graph') {
      const candidates = { ...before.navigation }
      for (const window of windows) {
        const parentId = window.scope.type === 'graph' ? window.scope.parentId : optionsRef.current.pageId
        for (const row of window.rows) candidates[row.id] = { id: row.id, title: String(row.cells[TITLE_COLUMN_ID]?.value ?? ''), parentId }
      }
      const hydrated = new Set(trimmed.windows.flatMap((window) => window.rows.map((row) => row.id)))
      const required = trimmed.windows.flatMap((window) => window.scope.type === 'graph' ? [window.scope.parentId] : [])
      for (const parentId of required) {
        let id = parentId
        const seen = new Set<string>()
        while (id !== optionsRef.current.pageId && candidates[id] && !seen.has(id)) {
          seen.add(id)
          if (!hydrated.has(id)) navigation[id] = candidates[id]
          id = candidates[id].parentId
        }
      }
    }
    const gaps = { ...before.gaps }
    if (param.cursor && param.replaceId === undefined) for (const window of projection.windows) {
      const oldIds = new Set(before.windows.filter((entry) => entry.key === window.key).flatMap((entry) => entry.rows.map((row) => row.id)))
      const restored = window.rows.filter((row) => !oldIds.has(row.page_id)).length, gap = gaps[window.key]
      const side = param.direction === 'previous' ? 'before' : 'after'
      if (gap) gaps[window.key] = { ...gap, [side]: Math.max(0, gap[side] - restored * (current.averageHeight.get(window.key) ?? 90)) }
    }
    for (const removed of trimmed.evicted) {
      const sameScope = windows.filter((window) => window.key === removed.key), retained = sameScope.filter((window) => trimmed.windows.includes(window))
      const beforeRetained = retained.length ? sameScope.indexOf(removed) < sameScope.indexOf(retained[0]) : Boolean(removed.nextCursor)
      const gap = gaps[removed.key] ?? { before: 0, after: 0 }, side = beforeRetained ? 'before' : 'after'
      gaps[removed.key] = { ...gap, [side]: gap[side] + removed.rows.length * (current.averageHeight.get(removed.key) ?? 90) }
    }
    const partialGroups = projection.kind === 'table' && Boolean(projection.groupsNextCursor)
    const groups = projection.groups ? param.groupCursor ? mergeDatabaseGroups(before.projection?.groups, projection.groups, true) : refreshDatabaseGroups(before.projection?.groups, projection.groups, partialGroups) : before.projection?.groups
    const failures = { ...before.failures }; delete failures[streamKey(param)]
    const preserveCatalogCursor = partialGroups && !param.groupCursor && (before.projection?.groups?.length ?? 0) > (projection.groups?.length ?? 0)
    const nextProjection = { ...before.projection, ...projection, groups, days: projection.days ?? before.projection?.days,
      ...(preserveCatalogCursor ? { groupsNextCursor: before.projection?.groupsNextCursor } : {}) }
    commit(current, { ...before, projection: nextProjection, windows: trimmed.windows, gaps, failures, navigation })
    const edges = trimmed.windows.filter((window) => window.key === streamKey(param))
    const edge = param.direction === 'previous' ? edges[0] : edges.at(-1)
    current.completed.set(`${streamKey(param)}:${param.direction ?? 'next'}`, `${requestKey(param)}@${edge?.id ?? 'missing'}`)
  }
  useEffect(() => {
    session.denied = false
    optionsRef.current.onRows([])
    return () => {
      if (session.timer) clearTimeout(session.timer)
      session.denied = true; session.queue = []
      void client.cancelQueries({ queryKey: key }); client.removeQueries({ queryKey: key })
    }
  }, [session, client, key])
  useEffect(() => {
    applyRef.current(query.data?.pages.at(-1))
    if (!query.isFetching && !session.running && !session.interactions && session.dirty && !session.timer) { session.dirty = false; reconcileRef.current() }
    pumpRef.current()
  }, [query.data, query.isFetching, session])
  useEffect(() => {
    if (!query.error || query.data || session.denied || session.active) return
    if ((query.error as { status?: number }).status === 403) deny()
    else if (!session.cache.failures[pageViewScopeKey(scope)]) fail(session, initialRef.current, query.error)
  }, [query.error, query.data, session, scope, deny, fail])
  const rows = useMemo(() => {
    const unique = new Map<string, RowData>()
    for (const window of cache.windows) for (const row of window.rows) unique.set(row.id, row)
    for (const entry of Object.values(cache.created)) unique.set(entry.row.id, entry.row)
    return [...unique.values()]
  }, [cache.windows, cache.created])
  useEffect(() => { optionsRef.current.onRows(rows) }, [rows])
  const syncRows = useCallback((incoming: RowData[]) => {
    const current = sessionRef.current, updates = new Map(incoming.map((row) => [row.id, row]))
    let changed = false
    const windows = current.cache.windows.map((window) => {
      const nextRows = window.rows.map((row) => {
        const update = updates.get(row.id)
        if (!update || sameCells(update, row)) return row
        changed = true; return update
      })
      return nextRows.some((row, index) => row !== window.rows[index]) ? { ...window, rows: nextRows } : window
    })
    const created = { ...current.cache.created }
    for (const [id, entry] of Object.entries(created)) {
      const update = updates.get(id)
      if (update && !sameCells(update, entry.row)) { created[id] = { ...entry, row: update }; changed = true }
    }
    if (changed) commit(current, { ...current.cache, windows, created })
  }, [commit])
  const onCreatedRow = useCallback((row: RowData) => {
    const current = sessionRef.current
    if (current.denied || !enabledRef.current) return
    const selectId = current.cache.projection?.selectColumnId ?? optionsRef.current.view?.board?.selectColumnId ?? optionsRef.current.columns?.find((column) => column.type === 'select')?.id
    const value = selectId ? row.cells[selectId]?.value : null
    const createdScope: PageViewQueryScope = optionsRef.current.view?.view === 'board' ? { type: 'board', optionId: typeof value === 'string' ? value : '__unassigned__' } : scopeRef.current
    commit(current, { ...current.cache, created: { ...current.cache.created, [row.id]: { row, scope: createdScope, wasPinned: Boolean(current.pins.get(row.id)) } } })
  }, [commit])
  const accepts = useCallback((pageId: string, entity: string, updatedAt: string) => {
    const current = sessionRef.current
    const belongs = pageId === optionsRef.current.pageId || current.cache.windows.some((window) => window.scope.type === 'graph' && window.scope.parentId === pageId)
    if (current.denied || current.revokedBranches.has(pageId) || !belongs) return false
    const id = `${pageId}:${entity}`, previous = current.clocks.get(id)
    // Timestamps reject older facts; ties follow Socket.IO emission order.
    // updatedAt is not a causal revision counter.
    if (previous !== undefined && previous > updatedAt) return false
    current.clocks.set(id, updatedAt)
    if (current.clocks.size > 3000) {
      const live = new Set([...current.cache.windows.flatMap((window) => window.rows.map((row) => row.id)), ...Object.keys(current.cache.created), ...Object.keys(current.cache.navigation)])
      for (const key of current.clocks.keys()) {
        const parts = key.split(':')
        if ((parts[1] === 'cell' || parts[1] === 'row') && !live.has(parts[2])) { current.clocks.delete(key); break }
      }
      // An unusually wide live dataset may need more clocks. Never discard
      // its ordering guard merely because many off-screen facts arrived.
    }
    return true
  }, [])
  const onEvent = useCallback((event: DatabaseRealtimeEvent) => {
    const entity = event.type === 'cell-updated' ? `cell:${event.payload.rowId}:${event.payload.columnId}` : event.type === 'row-updated' ? `cell:${event.payload.rowId}:${TITLE_COLUMN_ID}` : event.type === 'view-updated' ? 'view' : `column:${event.payload.columnId}`
    if (!accepts(event.payload.pageId, entity, event.payload.updatedAt)) return
    if (event.type !== 'cell-updated' && event.type !== 'row-updated') { invalidate(); return }
    const current = sessionRef.current, columnId = event.type === 'row-updated' ? TITLE_COLUMN_ID : event.payload.columnId
    const value = event.type === 'row-updated' ? event.payload.title : event.payload.value
    const loaded = current.cache.windows.some((window) => window.rows.some((row) => row.id === event.payload.rowId)) || Boolean(current.cache.created[event.payload.rowId])
    if (event.type === 'row-updated' && current.cache.navigation[event.payload.rowId]) commit(current, { ...current.cache, navigation: { ...current.cache.navigation, [event.payload.rowId]: { ...current.cache.navigation[event.payload.rowId], title: event.payload.title ?? '' } } })
    if (loaded) {
      const write = (row: RowData) => {
        if (row.id !== event.payload.rowId || JSON.stringify(row.cells[columnId]?.value) === JSON.stringify(value ?? undefined)) return row
        const cells = { ...row.cells }; if (value == null) delete cells[columnId]; else cells[columnId] = { value }
        return { ...row, cells }
      }
      const windows = current.cache.windows.map((window) => { const rows = window.rows.map(write); return rows.some((row, index) => row !== window.rows[index]) ? { ...window, rows } : window })
      const created = { ...current.cache.created }, entry = created[event.payload.rowId]
      if (entry) created[event.payload.rowId] = { ...entry, row: write(entry.row) }
      commit(current, { ...current.cache, windows, created })
    }
    const opts = optionsRef.current
    const depends = opts.filters.clauses.some((clause) => clause.columnId === columnId) || (opts.view?.view !== 'board' && opts.filters.groupBy.includes(columnId)) || columnId === opts.view?.board?.selectColumnId || columnId === current.cache.projection?.selectColumnId || columnId === opts.view?.dateColumnId || columnId === current.cache.projection?.dateColumnId
    if (depends || (loaded && queryRef.current.isFetching)) invalidate()
  }, [accepts, commit, invalidate])
  const onStructure = useCallback((event: PageStructureEvent) => {
    const entity = event.type === 'column-deleted' ? `column:${event.payload.columnId}` : `row:${event.payload.rowId}`
    if (!accepts(event.payload.pageId, entity, event.payload.updatedAt)) return
    const current = sessionRef.current
    if (event.type === 'row-deleted') {
      const created = { ...current.cache.created }; delete created[event.payload.rowId]
      const navigation = { ...current.cache.navigation }
      const removed = new Set([event.payload.rowId])
      let grew = true
      while (grew) {
        grew = false
        for (const node of Object.values(navigation)) if (removed.has(node.parentId) && !removed.has(node.id)) { removed.add(node.id); grew = true }
        for (const window of current.cache.windows) if (window.scope.type === 'graph' && removed.has(window.scope.parentId)) for (const row of window.rows) if (!removed.has(row.id)) { removed.add(row.id); grew = true }
      }
      for (const id of removed) delete navigation[id]
      commit(current, { ...current.cache, created, navigation, deletedRowIds: [...current.cache.deletedRowIds.filter((id) => id !== event.payload.rowId), event.payload.rowId].slice(-256), windows: current.cache.windows.filter((window) => window.scope.type !== 'graph' || !removed.has(window.scope.parentId)).map((window) => ({ ...window, rows: window.rows.filter((row) => !removed.has(row.id)) })) })
    }
    invalidate()
  }, [accepts, commit, invalidate])
  const onRowOrder = useCallback((payload: RowOrderUpdatedPayload) => { if (payload.viewId === optionsRef.current.viewId && accepts(payload.pageId, `order:${payload.viewId}`, payload.updatedAt)) invalidate() }, [accepts, invalidate])
  const bridge = useMemo<DatabaseProjectionBridge>(() => ({ orderRevision: cache.projection?.orderRevision ?? 0, onLocalRows: syncRows, onCreatedRow, onEvent, onStructure, onRowOrder, onResync: invalidate, onAccessDenied: deny }), [cache.projection?.orderRevision, syncRows, onCreatedRow, onEvent, onStructure, onRowOrder, invalidate, deny])
  const bridgeRef = useRef(bridge); bridgeRef.current = bridge
  const branchIds = [...new Set(cache.windows.flatMap((window) => window.scope.type === 'graph' && window.scope.parentId !== options.pageId ? [window.scope.parentId] : []))].sort().join(',')
  const branchChannels = useRef(new Map<string, PageRealtimeChannel>())
  useEffect(() => {
    const channels = branchChannels.current
    return () => { for (const channel of channels.values()) channel.dispose(); channels.clear() }
  }, [session, socket])
  useEffect(() => {
    if (!socket || options.view?.view !== 'graph' || !enabled) return
    const desired = new Set(branchIds ? branchIds.split(',') : [])
    for (const [parentId, channel] of branchChannels.current) if (!desired.has(parentId)) { channel.dispose(); branchChannels.current.delete(parentId) }
    for (const parentId of desired) {
      if (branchChannels.current.has(parentId)) continue
      const channel = new PageRealtimeChannel(socket, parentId, {
        onEvent: (event) => { if (session === sessionRef.current) bridgeRef.current.onEvent(event) },
        onStructureChanged: (event) => { if (session === sessionRef.current) bridgeRef.current.onStructure(event) },
        onResync: () => { if (session === sessionRef.current) bridgeRef.current.onResync() },
        onAccessDenied: () => {
          if (session !== sessionRef.current) return
          const removed = new Set([parentId])
          let grew = true
          while (grew) {
            grew = false
            for (const node of Object.values(session.cache.navigation)) if (removed.has(node.parentId) && !removed.has(node.id)) { removed.add(node.id); grew = true }
            for (const window of session.cache.windows) if (window.scope.type === 'graph' && removed.has(window.scope.parentId)) for (const row of window.rows) if (!removed.has(row.id)) { removed.add(row.id); grew = true }
          }
          for (const id of removed) session.revokedBranches.add(id)
          session.generation++
          session.queue = session.queue.filter((param) => param.scope?.type !== 'graph' || !removed.has(param.scope.parentId))
          const navigation = { ...session.cache.navigation }
          for (const id of removed) delete navigation[id]
          commit(session, { ...session.cache, navigation, windows: session.cache.windows.filter((window) => window.scope.type !== 'graph' || !removed.has(window.scope.parentId)) })
        },
      })
      branchChannels.current.set(parentId, channel); channel.subscribe()
    }
  }, [branchIds, socket, options.view?.view, enabled, session, commit])
  const load = useCallback((target: PageViewQueryScope, direction: 'next' | 'previous') => {
    const current = sessionRef.current, stream = current.cache.windows.filter((window) => window.key === pageViewScopeKey(target))
    const edge = direction === 'next' ? stream.at(-1) : stream[0], cursor = direction === 'next' ? edge?.nextCursor : edge?.previousCursor
    if (edge && !cursor) return
    const param: FetchParam = { scope: target, cursor, direction, limit: 50 }
    if (current.completed.get(`${pageViewScopeKey(target)}:${direction}`) !== `${requestKey(param)}@${edge?.id ?? 'missing'}`) enqueue(param)
  }, [enqueue])
  const loadNext = useCallback((target: PageViewQueryScope) => load(target, 'next'), [load])
  const loadPrevious = useCallback((target: PageViewQueryScope) => load(target, 'previous'), [load])
  const ensureScope = useCallback((target: PageViewQueryScope) => { if (!sessionRef.current.cache.windows.some((window) => window.key === pageViewScopeKey(target))) enqueue({ scope: target, limit: 50 }) }, [enqueue])
  const reportWindow = useCallback((stream: string, viewport: WindowViewport) => {
    const current = sessionRef.current
    current.viewports.set(stream, viewport)
    const count = current.cache.windows.filter((window) => window.key === stream).reduce((sum, window) => sum + window.rows.length, 0)
    if (viewport.height && count) current.averageHeight.set(stream, viewport.height / count)
  }, [])
  const pinRow = useCallback((id: string, active: boolean) => {
    const current = sessionRef.current, count = Math.max(0, (current.pins.get(id) ?? 0) + (active ? 1 : -1))
    if (count) current.pins.set(id, count); else current.pins.delete(id)
    const entry = current.cache.created[id]
    if (!entry) return
    if (active && !entry.wasPinned) commit(current, { ...current.cache, created: { ...current.cache.created, [id]: { ...entry, wasPinned: true } } })
    else if (!count && entry.wasPinned) { const created = { ...current.cache.created }; delete created[id]; commit(current, { ...current.cache, created }); invalidate() }
  }, [commit, invalidate])
  const onInteractionChange = useCallback((active: boolean) => {
    const current = sessionRef.current
    current.interactions = Math.max(0, current.interactions + (active ? 1 : -1))
    if (!current.interactions && current.dirty && !current.timer && !current.running && !queryRef.current.isFetching) { current.dirty = false; reconcileRef.current() }
  }, [])
  const loadGroups = useCallback(() => { const cursor = sessionRef.current.cache.projection?.groupsNextCursor; if (cursor) enqueue({ scope: ROOT, groupCursor: cursor, limit: 50 }) }, [enqueue])
  const setScope = useCallback((target: PageViewQueryScope) => {
    if (optionsRef.current.view?.view !== 'calendar') return
    // The initial API projection may already cover the requested visible days.
    // Keep that batch rather than recreating the query merely to adopt its scope.
    if (sessionRef.current.cache.windows.some((window) => window.scope.type === 'calendar' && !window.scope.day && pageViewScopeKey(window.scope) === pageViewScopeKey(target))) return
    updateScope((previous) => previous.owner === ownerRef.current && pageViewScopeKey(previous.scope) === pageViewScopeKey(target) ? previous : { owner: ownerRef.current, scope: target })
  }, [])
  const retry = useCallback((target?: PageViewQueryScope) => {
    const current = sessionRef.current, id = pageViewScopeKey(target ?? scopeRef.current), failure = current.cache.failures[id]
    if (!failure || current.denied) return
    const failures = { ...current.cache.failures }; delete failures[id]
    commit(current, { ...current.cache, failures }); current.completed.clear()
    if (!queryRef.current.data) void queryRef.current.refetch()
    else enqueue(failure.param)
  }, [commit, enqueue])
  const pagination = useMemo<DatabasePagination>(() => {
    const streams: DatabasePagination['streams'] = {}
    for (const window of cache.windows) {
      const previous = streams[window.key]
      streams[window.key] = {
        scope: window.scope, rows: [...(previous?.rows ?? []), ...window.rows], total: window.total,
        hasNextPage: Boolean(window.nextCursor), hasPreviousPage: previous?.hasPreviousPage ?? Boolean(window.previousCursor),
        isFetching: query.isFetching && (!session.next?.scope || pageViewScopeKey(session.next.scope) === window.key), error: cache.failures[window.key]?.error,
        beforeHeight: cache.gaps[window.key]?.before ?? 0, afterHeight: cache.gaps[window.key]?.after ?? 0,
      }
    }
    for (const entry of Object.values(cache.created)) {
      const id = pageViewScopeKey(entry.scope), stream = streams[id] ?? { scope: entry.scope, rows: [], total: 0, hasNextPage: false, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0 }
      streams[id] = { ...stream, rows: [...stream.rows.filter((row) => row.id !== entry.row.id), entry.row] }
    }
    for (const [id, failure] of Object.entries(cache.failures)) if (!streams[id]) streams[id] = { scope: failure.param.scope ?? ROOT, rows: [], total: 0, hasNextPage: false, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0, error: failure.error }
    return { projection: cache.projection, streams, loading: enabled && !session.denied && query.isPending, error: cache.failures[pageViewScopeKey(scope)]?.error, deletedRowIds: cache.deletedRowIds, revoked: session.denied, navigation: cache.navigation,
      loadNext, loadPrevious, ensureScope, setScope, reportWindow, pinRow, onInteractionChange, loadGroups, retry }
  }, [cache, enabled, loadNext, loadPrevious, ensureScope, setScope, reportWindow, pinRow, onInteractionChange, loadGroups, retry, query.isFetching, query.isPending, session, scope])
  return { pagination, bridge, error: query.error }
}
