import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDatabasePagination } from './useDatabasePagination'
import { pageViewScopeKey, type PageViewQueryProjection, type PageViewQueryScope } from '@/shared/cubs-database/pageViewQueryContract'
import type { DataViewType, ViewFiltersV2 } from 'cubs-database'
const queryView = vi.hoisted(() => vi.fn())
vi.mock('@/services/DatabaseService', () => ({ databaseService: { queryView } }))
vi.mock('@/hooks/useSocket', () => ({ useSocket: () => ({ socket: null }) }))
const filters: ViewFiltersV2 = { version: 2, updatedAt: null, clauses: [], groupBy: [], passthrough: [] }
const projection = (start = 0): PageViewQueryProjection => ({ version: 1, kind: 'table', pageId: 'page', viewId: 'view', queryKey: 'query', orderRevision: 1, total: 10000, windows: [{ key: 'root', scope: { type: 'root' }, rows: Array.from({ length: 50 }, (_, index) => ({ page_id: `row-${start + index}`, page_title: `Title ${start + index}`, page_columns: {} })), total: 10000, nextCursor: `cursor-${start + 50}`, previousCursor: start ? `cursor-${start}` : null }] })
function setup(enabled = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const onRows = vi.fn()
  const hook = renderHook(() => useDatabasePagination({ pageId: 'page', viewId: 'view', view: { view: 'table', name: 'Tabela' } as DataViewType, filters: { version: 2, updatedAt: null, clauses: [], groupBy: [], passthrough: [] }, enabled, onRows }), { wrapper })
  return { ...hook, onRows }
}
function dynamicSetup(kind: DataViewType['view'] = 'table', initialFilters = filters, initialView?: DataViewType) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const onRows = vi.fn()
  const initialProps = { viewId: 'view', view: initialView ?? { view: kind, name: kind } as DataViewType, filters: initialFilters }
  const hook = renderHook((props: typeof initialProps) => useDatabasePagination({ pageId: 'page', enabled: true, onRows, ...props }), { wrapper, initialProps })
  return { ...hook, onRows, initialProps }
}
function scopedProjection(scope: PageViewQueryScope, start = 0, kind: DataViewType['view'] = 'table') {
  const result = projection(start)
  result.kind = kind
  result.windows[0] = { ...result.windows[0], key: pageViewScopeKey(scope), scope }
  if (kind === 'board') result.selectColumnId = 'status'
  return result
}
describe('SQL projection pagination transport', () => {
  beforeEach(() => { queryView.mockReset(); queryView.mockResolvedValue(projection()) })
  it('loads one initial batch and advances by the API cursor', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    expect(queryView).toHaveBeenCalledTimes(1)
    queryView.mockResolvedValueOnce(projection(50))
    act(() => hook.result.current.pagination.loadNext({ type: 'root' }))
    await waitFor(() => expect(hook.result.current.pagination.streams.root.rows).toHaveLength(100))
    expect(queryView.mock.calls[1][2].cursor).toBe('cursor-50')
  })
  it('does not materialize an unseen row from a socket fact', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    act(() => hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'unseen', title: 'Changed', updatedAt: new Date().toISOString(), originUserId: 'user' } }))
    expect(hook.result.current.pagination.streams.root.rows).toHaveLength(50)
    expect(queryView).toHaveBeenCalledTimes(1)
  })
  it('keeps reference identities for unaffected cards and clears revoked data', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    const unaffected = hook.result.current.pagination.streams.root.rows[1]
    act(() => hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'row-0', title: 'Changed', updatedAt: new Date().toISOString(), originUserId: 'user' } }))
    expect(hook.result.current.pagination.streams.root.rows[1]).toBe(unaffected)
    act(() => hook.result.current.bridge.onAccessDenied())
    expect(hook.result.current.pagination.projection).toBeNull()
    expect(hook.result.current.pagination.streams).toEqual({})
  })
  it('does not fetch document/form rows when disabled', async () => {
    const hook = setup(false)
    await act(async () => {})
    expect(queryView).not.toHaveBeenCalled()
    expect(hook.result.current.pagination.streams).toEqual({})
  })
  it('starts every new owner at root after a Calendar period was selected', async () => {
    queryView.mockImplementation(async (_page: string, _view: string, input: { scope: PageViewQueryScope }) => scopedProjection(input.scope))
    const hook = dynamicSetup('calendar')
    await waitFor(() => expect(hook.result.current.pagination.projection).not.toBeNull())
    act(() => hook.result.current.pagination.setScope({ type: 'calendar', from: '2026-10-01', to: '2026-10-31' }))
    await waitFor(() => expect(queryView.mock.calls.at(-1)?.[2].scope.type).toBe('calendar'))
    for (const kind of ['board', 'table', 'graph'] as const) {
      const count = queryView.mock.calls.length
      hook.rerender({ ...hook.initialProps, viewId: kind, view: { view: kind, name: kind } as DataViewType })
      await waitFor(() => expect(queryView.mock.calls.length).toBeGreaterThan(count))
      expect(queryView.mock.calls[count][2].scope).toEqual({ type: 'root' })
      await waitFor(() => expect(hook.result.current.pagination.projection).not.toBeNull())
    }
  })
  it('keeps cached rows and pins when only presentation or filter ACK metadata changes', async () => {
    const hook = dynamicSetup('board')
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    const row = hook.result.current.pagination.streams.root.rows[0]
    const callbacks = hook.result.current.pagination
    act(() => hook.result.current.pagination.pinRow?.(row.id, true))
    hook.rerender({ ...hook.initialProps, filters: { ...filters, updatedAt: '2026-10-05T12:00:00.000Z', passthrough: [['tracking', 'on']] }, view: { ...hook.initialProps.view, name: 'Quadros', board: { propertyIds: ['date'], showPropertyLabels: false, collapsedOptionIds: ['one'], optionOrder: ['two', 'one'] } } })
    await act(async () => {})
    expect(queryView).toHaveBeenCalledTimes(1)
    expect(hook.result.current.pagination.streams.root.rows[0]).toBe(row)
    expect(hook.result.current.pagination.pinRow).toBe(callbacks.pinRow)
    expect(hook.result.current.pagination.onInteractionChange).toBe(callbacks.onInteractionChange)
    queryView.mockResolvedValueOnce(projection(50))
    act(() => hook.result.current.pagination.loadNext({ type: 'root' }))
    await waitFor(() => expect(queryView).toHaveBeenCalledTimes(2))
    expect(queryView.mock.calls[1][2].filters.updatedAt).toBe('2026-10-05T12:00:00.000Z')
  })
  it('does not repeat a cursor during rapid scroll or response publication', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    let resolve!: (value: PageViewQueryProjection) => void
    queryView.mockImplementationOnce(() => new Promise<PageViewQueryProjection>((done) => { resolve = done }))
    act(() => { for (let index = 0; index < 20; index++) hook.result.current.pagination.loadNext({ type: 'root' }) })
    await waitFor(() => expect(queryView).toHaveBeenCalledTimes(2))
    queryView.mockResolvedValue(projection(100))
    await act(async () => { resolve(projection(50)); await Promise.resolve(); for (let index = 0; index < 20; index++) hook.result.current.pagination.loadNext({ type: 'root' }) })
    await waitFor(() => expect(hook.result.current.pagination.streams.root.rows.length).toBeGreaterThanOrEqual(100))
    expect(queryView.mock.calls.filter((call) => call[2].cursor === 'cursor-50')).toHaveLength(1)
  })
  it('retains a newly created card and its latest properties until all editor pins finish', async () => {
    queryView.mockResolvedValue(scopedProjection({ type: 'board', optionId: 'one' }, 0, 'board'))
    const hook = dynamicSetup('board')
    await waitFor(() => expect(hook.result.current.pagination.streams['board:one']?.rows).toHaveLength(50))
    const draft = { id: 'new-page', cells: { page_title: { value: 'New' }, status: { value: 'one' }, note: { value: 'original' } } }
    act(() => hook.result.current.bridge.onCreatedRow(draft))
    expect(hook.result.current.pagination.streams['board:one'].rows.at(-1)?.id).toBe('new-page')
    act(() => {
      hook.result.current.pagination.pinRow?.('new-page', true)
      hook.result.current.pagination.pinRow?.('new-page', true)
      hook.result.current.pagination.onInteractionChange?.(true)
      hook.result.current.bridge.onLocalRows([{ ...draft, cells: { ...draft.cells, page_title: { value: 'Edited' }, note: { value: 'latest' } } }])
      hook.result.current.bridge.onResync()
    })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 230)) })
    expect(queryView).toHaveBeenCalledTimes(1)
    act(() => hook.result.current.pagination.pinRow?.('new-page', false))
    const retained = hook.result.current.pagination.streams['board:one'].rows.at(-1)
    expect(retained?.cells.page_title?.value).toBe('Edited')
    expect(retained?.cells.status?.value).toBe('one')
    expect(retained?.cells.note?.value).toBe('latest')
    expect(hook.onRows.mock.calls.at(-1)?.[0].at(-1)?.id).toBe('new-page')
    act(() => { hook.result.current.pagination.pinRow?.('new-page', false); hook.result.current.pagination.onInteractionChange?.(false) })
    await waitFor(() => expect(queryView).toHaveBeenCalledTimes(2))
    expect(hook.result.current.pagination.streams['board:one'].rows.some((row) => row.id === 'new-page')).toBe(false)
  })
  it('rejects older facts for loaded root and Graph branch cells, accepting timestamp ties', async () => {
    const hook = dynamicSetup('graph')
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    queryView.mockResolvedValueOnce(scopedProjection({ type: 'graph', parentId: 'branch' }, 100, 'graph'))
    act(() => hook.result.current.pagination.ensureScope({ type: 'graph', parentId: 'branch' }))
    await waitFor(() => expect(hook.result.current.pagination.streams['graph:branch']?.rows).toHaveLength(50))
    for (const [pageId, rowId, key] of [['page', 'row-0', 'root'], ['branch', 'row-100', 'graph:branch']]) {
      const fact = (title: string, updatedAt: string) => ({ type: 'row-updated' as const, payload: { pageId, rowId, title, updatedAt, originUserId: 'user' } })
      act(() => { hook.result.current.bridge.onEvent(fact('Newest', '2026-10-05T12:00:02.000Z')); hook.result.current.bridge.onEvent(fact('Older', '2026-10-05T12:00:01.000Z')) })
      expect(hook.result.current.pagination.streams[key].rows[0].cells.page_title?.value).toBe('Newest')
      act(() => hook.result.current.bridge.onEvent(fact('Same millisecond', '2026-10-05T12:00:02.000Z')))
      expect(hook.result.current.pagination.streams[key].rows[0].cells.page_title?.value).toBe('Same millisecond')
    }
  })
  it('holds a failed stream until explicit retry instead of a scroll feedback loop', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    const failure = Object.assign(new Error('failed'), { status: 500 })
    queryView.mockRejectedValueOnce(failure)
    act(() => hook.result.current.pagination.loadNext({ type: 'root' }))
    await waitFor(() => expect(hook.result.current.pagination.streams.root.error).toBe(failure))
    act(() => { for (let index = 0; index < 20; index++) { hook.result.current.pagination.loadNext({ type: 'root' }); hook.result.current.pagination.ensureScope({ type: 'root' }) } })
    await act(async () => {})
    expect(queryView).toHaveBeenCalledTimes(2)
    queryView.mockResolvedValueOnce(projection(50))
    act(() => hook.result.current.pagination.retry?.({ type: 'root' }))
    await waitFor(() => expect(hook.result.current.pagination.streams.root.rows).toHaveLength(100))
    expect(hook.result.current.pagination.streams.root.error).toBeUndefined()
    expect(queryView).toHaveBeenCalledTimes(3)
  })
  it('exposes initial failure and retries once without materializing rows', async () => {
    const failure = Object.assign(new Error('offline'), { status: 500 })
    queryView.mockRejectedValueOnce(failure)
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.error).toBe(failure))
    expect(hook.result.current.pagination.projection).toBeNull()
    act(() => hook.result.current.pagination.retry?.())
    await waitFor(() => expect(hook.result.current.pagination.streams.root.rows).toHaveLength(50))
    expect(queryView).toHaveBeenCalledTimes(2)
  })
  it('never rehydrates a revoked view from a late response', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    let resolve!: (value: PageViewQueryProjection) => void
    queryView.mockImplementationOnce(() => new Promise<PageViewQueryProjection>((done) => { resolve = done }))
    act(() => hook.result.current.pagination.loadNext({ type: 'root' }))
    await waitFor(() => expect(queryView).toHaveBeenCalledTimes(2))
    act(() => hook.result.current.bridge.onAccessDenied())
    await act(async () => { resolve(projection(50)); await Promise.resolve(); hook.result.current.bridge.onResync() })
    expect(hook.result.current.pagination.projection).toBeNull()
    expect(hook.result.current.pagination.streams).toEqual({})
    expect(hook.onRows.mock.calls.at(-1)?.[0]).toEqual([])
    expect(queryView).toHaveBeenCalledTimes(2)
  })
  it('preserves measured spacer heights and the incoming previous batch across global eviction', async () => {
    queryView.mockImplementation(async (_page: string, _view: string, input: { cursor?: string; direction?: string }) => projection(input.cursor ? Number(input.cursor.split('-')[1]) - (input.direction === 'previous' ? 50 : 0) : 0))
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    for (let index = 1; index <= 5; index++) {
      const current = hook.result.current.pagination.streams.root
      act(() => { hook.result.current.pagination.reportWindow?.('root', { height: current.rows.length * 40, firstId: current.rows.at(-1)?.id, lastId: current.rows.at(-1)?.id }); hook.result.current.pagination.loadNext({ type: 'root' }) })
      await waitFor(() => expect(hook.result.current.pagination.streams.root.rows.at(-1)?.id).toBe(`row-${index * 50 + 49}`))
    }
    expect(hook.result.current.pagination.streams.root.rows).toHaveLength(250)
    expect(hook.result.current.pagination.streams.root.beforeHeight).toBe(2000)
    act(() => { hook.result.current.pagination.reportWindow?.('root', { height: 10000, firstId: 'row-50', lastId: 'row-99' }); hook.result.current.pagination.loadPrevious({ type: 'root' }) })
    await waitFor(() => expect(hook.result.current.pagination.streams.root.rows[0].id).toBe('row-0'))
    expect(hook.result.current.pagination.streams.root.rows).toHaveLength(250)
    expect(hook.result.current.pagination.streams.root.beforeHeight).toBe(0)
    expect(hook.result.current.pagination.streams.root.afterHeight).toBe(2000)
  })
  it('refreshes grouped metadata authoritatively without losing previously loaded header pages', async () => {
    const group = (key: string, total = 3) => ({ key, label: key, total, path: [] })
    queryView.mockResolvedValueOnce({ ...projection(), groups: [group('one'), group('two')], groupsNextCursor: 'header-next' })
    const hook = dynamicSetup('table', { ...filters, groupBy: ['status'] })
    await waitFor(() => expect(hook.result.current.pagination.projection?.groups).toHaveLength(2))
    queryView.mockResolvedValueOnce({ ...projection(), windows: [], groups: [group('later')], groupsNextCursor: null })
    act(() => hook.result.current.pagination.loadGroups?.())
    await waitFor(() => expect(hook.result.current.pagination.projection?.groups).toHaveLength(3))
    queryView.mockImplementation(async (_page, _view, input) => ({ ...projection(), windows: input.metadataOnly ? [] : projection().windows, groups: [group('two', 4), group('one', 5)], groupsNextCursor: 'header-fresh' }))
    act(() => hook.result.current.bridge.onResync())
    await waitFor(() => expect(hook.result.current.pagination.projection?.groups?.[0].total).toBe(4))
    expect(hook.result.current.pagination.projection?.groups?.map((entry) => entry.key)).toEqual(['two', 'one', 'later'])
    expect(hook.result.current.pagination.projection?.groupsNextCursor).toBeNull()
  })
  it('keeps only ancestor navigation metadata when Graph hydration evicts the root batch', async () => {
    queryView.mockImplementation(async (_page: string, _view: string, input: { scope: PageViewQueryScope }) => scopedProjection(input.scope, input.scope.type === 'graph' ? Number(input.scope.parentId.slice(4)) * 100 + 100 : 0, 'graph'))
    const hook = dynamicSetup('graph')
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    for (let index = 0; index < 5; index++) {
      act(() => hook.result.current.pagination.ensureScope({ type: 'graph', parentId: `row-${index}` }))
      await waitFor(() => expect(hook.result.current.pagination.streams[`graph:row-${index}`]?.rows).toHaveLength(50))
    }
    expect(Object.values(hook.result.current.pagination.streams).flatMap((stream) => stream.rows)).toHaveLength(250)
    expect(Object.keys(hook.result.current.pagination.navigation ?? {})).toHaveLength(5)
    expect(hook.result.current.pagination.navigation?.['row-0']).toEqual({ id: 'row-0', title: 'Title 0', parentId: 'page' })
    expect(hook.result.current.pagination.streams.root).toBeUndefined()
    act(() => hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'row-0', title: 'New ancestor name', updatedAt: '2026-10-05T12:00:00.000Z', originUserId: 'user' } }))
    expect(hook.result.current.pagination.navigation?.['row-0'].title).toBe('New ancestor name')
    act(() => hook.result.current.bridge.onStructure({ type: 'row-deleted', payload: { pageId: 'page', rowId: 'row-0', updatedAt: '2026-10-05T12:00:01.000Z', originUserId: 'user' } }))
    expect(hook.result.current.pagination.streams['graph:row-0']).toBeUndefined()
    expect(hook.result.current.pagination.navigation?.['row-0']).toBeUndefined()
    expect(hook.result.current.pagination.deletedRowIds).toContain('row-0')
  })
  it('recovers a stale initial response once after realtime changes its filter dependencies', async () => {
    let resolve!: (value: PageViewQueryProjection) => void
    queryView.mockImplementationOnce(() => new Promise<PageViewQueryProjection>((done) => { resolve = done }))
    const hook = dynamicSetup('board', filters, { view: 'board', name: 'Board', board: { selectColumnId: 'status' } } as DataViewType)
    await waitFor(() => expect(queryView).toHaveBeenCalled())
    act(() => hook.result.current.bridge.onEvent({ type: 'cell-updated', payload: { pageId: 'page', rowId: 'unseen', columnId: 'status', value: 'one', updatedAt: '2026-10-05T12:00:00.000Z', originUserId: 'user' } }))
    await act(async () => { await new Promise((done) => setTimeout(done, 210)); resolve(projection()) })
    await waitFor(() => expect(hook.result.current.pagination.projection).not.toBeNull())
    expect(queryView).toHaveBeenCalledTimes(2)
  })
  it('adopts an initial Calendar period that already matches visible days without another request', async () => {
    const period = { type: 'calendar' as const, from: '2026-09-27', to: '2026-10-31' }
    queryView.mockResolvedValueOnce(scopedProjection(period, 0, 'calendar'))
    const hook = dynamicSetup('calendar')
    await waitFor(() => expect(hook.result.current.pagination.projection).not.toBeNull())
    act(() => hook.result.current.pagination.setScope(period))
    await act(async () => {})
    expect(queryView).toHaveBeenCalledTimes(1)
    expect(hook.result.current.pagination.streams[pageViewScopeKey(period)].rows).toHaveLength(50)
  })
  it('loads rows under StrictMode effect replay', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode><QueryClientProvider client={client}>{children}</QueryClientProvider></StrictMode>
    const hook = renderHook(() => useDatabasePagination({ pageId: 'page', viewId: 'view', view: { view: 'table', name: 'Tabela' } as DataViewType, filters, enabled: true, onRows: vi.fn() }), { wrapper })
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    expect(hook.result.current.pagination.revoked).toBe(false)
  })
  it('refreshes during continuous realtime traffic instead of waiting for silence', async () => {
    const hook = dynamicSetup('board', filters, { view: 'board', name: 'Board', board: { selectColumnId: 'status' } } as DataViewType)
    await waitFor(() => expect(hook.result.current.pagination.projection).not.toBeNull())
    for (let index = 0; index < 6; index++) {
      act(() => hook.result.current.bridge.onEvent({ type: 'cell-updated', payload: { pageId: 'page', rowId: `unseen-${index}`, columnId: 'status', value: 'one', updatedAt: `2026-10-05T12:00:0${index}.000Z`, originUserId: 'user' } }))
      await act(async () => { await new Promise((done) => setTimeout(done, 100)) })
      if (index === 2) expect(queryView.mock.calls.length).toBeGreaterThanOrEqual(2)
    }
    expect(queryView.mock.calls.length).toBeGreaterThanOrEqual(3)
  })
  it('never evicts the clock of a loaded cell when unseen facts flood the channel', async () => {
    const hook = setup()
    await waitFor(() => expect(hook.result.current.pagination.streams.root?.rows).toHaveLength(50))
    act(() => {
      hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'row-0', title: 'Newest', updatedAt: '2026-10-05T12:00:02.000Z', originUserId: 'user' } })
      for (let index = 0; index < 3100; index++) hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: `unseen-${index}`, title: 'Other', updatedAt: '2026-10-05T12:00:03.000Z', originUserId: 'user' } })
      hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'row-0', title: 'Older', updatedAt: '2026-10-05T12:00:01.000Z', originUserId: 'user' } })
    })
    expect(hook.result.current.pagination.streams.root.rows[0].cells.page_title?.value).toBe('Newest')
    expect(queryView).toHaveBeenCalledTimes(1)
  })
  it('retains a created draft and its latest title across filters in the same view only', async () => {
    const scope = { type: 'board' as const, optionId: 'one' }
    queryView.mockResolvedValue(scopedProjection(scope, 0, 'board'))
    const hook = dynamicSetup('board')
    await waitFor(() => expect(hook.result.current.pagination.streams['board:one']?.rows).toHaveLength(50))
    const draft = { id: 'draft', cells: { page_title: { value: 'Original' }, status: { value: 'one' }, note: { value: 'Latest property' } } }
    act(() => {
      hook.result.current.bridge.onCreatedRow(draft)
      hook.result.current.pagination.pinRow?.('draft', true)
      hook.result.current.pagination.onInteractionChange?.(true)
      hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'draft', title: 'Edited', updatedAt: '2026-10-05T12:00:02.000Z', originUserId: 'user' } })
    })
    hook.rerender({ ...hook.initialProps, filters: { ...filters, clauses: [{ columnId: 'page_title', condition: 'contains', values: ['different filter'] }] } })
    await waitFor(() => expect(queryView).toHaveBeenCalledTimes(2))
    expect(hook.result.current.pagination.streams['board:one'].rows.at(-1)?.cells.page_title?.value).toBe('Edited')
    expect(hook.result.current.pagination.streams['board:one'].rows.at(-1)?.cells.note?.value).toBe('Latest property')
    act(() => hook.result.current.bridge.onEvent({ type: 'row-updated', payload: { pageId: 'page', rowId: 'draft', title: 'Older', updatedAt: '2026-10-05T12:00:01.000Z', originUserId: 'user' } }))
    expect(hook.result.current.pagination.streams['board:one'].rows.at(-1)?.cells.page_title?.value).toBe('Edited')
    act(() => { hook.result.current.pagination.pinRow?.('draft', false); hook.result.current.pagination.onInteractionChange?.(false) })
    await waitFor(() => expect(hook.result.current.pagination.streams['board:one'].rows.some((row) => row.id === 'draft')).toBe(false))
    act(() => hook.result.current.bridge.onCreatedRow(draft))
    hook.rerender({ ...hook.initialProps, viewId: 'other-view' })
    expect(Object.values(hook.result.current.pagination.streams).flatMap((stream) => stream.rows).some((row) => row.id === 'draft')).toBe(false)
  })
})
