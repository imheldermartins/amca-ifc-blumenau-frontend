import { useRef, type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowExecutionResult, HeaderCol, RowData, ViewFiltersV2 } from 'cubs-database'
import type { PageViewQueryProjection, PageViewQueryRequest } from '@/shared/cubs-database/pageViewQueryContract'
import { usePageDatabase } from './usePageDatabase'
import { useDatabasePagination, type DatabaseProjectionBridge } from './useDatabasePagination'

const api = vi.hoisted(() => ({ load: vi.fn(), query: vi.fn(), move: vi.fn(), execute: vi.fn(), saveCell: vi.fn(), feedback: vi.fn() }))
vi.mock('@/services/DatabaseService', () => ({ databaseService: { loadPage: api.load, queryView: api.query } }))
vi.mock('@/services/PageWriteService', () => ({ pageWriteService: { moveRow: api.move, saveCell: api.saveCell } }))
vi.mock('@/services/FlowService', () => ({ flowService: { execute: api.execute } }))
vi.mock('@/contexts/FeedbackContext', () => ({ useFeedback: () => api.feedback }))
vi.mock('@/hooks/useSocket', () => ({ useSocket: () => ({ socket: null }) }))
vi.mock('@/lib/i18n', () => ({ i18n: (key: string) => key }))

const filters: ViewFiltersV2 = { version: 2, updatedAt: null, clauses: [], groupBy: [], passthrough: [] }
const columns: HeaderCol[] = [
  { id: 'status', title: 'Status', type: 'select', options: [{ id: 'todo', label: 'A fazer' }, { id: 'done', label: 'Feito' }] },
  { id: 'flow', title: 'Concluir', type: 'flow', flow: { version: 2, trigger: { type: 'manual' }, nodes: [
    { id: 'start', type: 'start', config: {} },
    { id: 'change', type: 'set_value', config: { columnId: 'status', value: 'done' } },
    { id: 'end', type: 'callback', config: {} },
  ] } },
]
const view = { view: 'board' as const, name: 'Quadro', urlKey: { key: 'quadro', aliases: [] }, filters, orderedHeaderCols: ['status', 'flow'], board: { selectColumnId: 'status' } }
let serverRows: RowData[]
function projection(input: PageViewQueryRequest = {}): PageViewQueryProjection {
  const groups = ['todo', 'done'].map((value) => ({ key: `board:${value}`, value, label: value, path: [], total: serverRows.filter((row) => row.cells.status?.value === value).length }))
  const scope = input.scope
  return { version: 1, kind: 'board', pageId: 'page', viewId: 'view', queryKey: 'q', selectColumnId: 'status', total: serverRows.length, orderRevision: 1, groups,
    windows: groups.filter((group) => !scope || scope.type !== 'board' || scope.optionId === group.value).map((group) => ({
      key: group.key, scope: { type: 'board', optionId: group.value }, total: group.total, previousCursor: null, nextCursor: null,
      rows: serverRows.filter((row) => row.cells.status?.value === group.value).map((row) => ({ page_id: row.id, page_title: row.id, page_columns: {
        status: { row_id: row.id, row_data: JSON.stringify({ value: row.cells.status?.value }), column_name: 'Status', column_type: 'select', column_data: null },
      } })),
    })) }
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => {
    const bridge = useRef<DatabaseProjectionBridge | null>(null)
    const page = usePageDatabase('page', bridge)
    const paged = useDatabasePagination({ pageId: 'page', viewId: 'view', view, columns, filters, enabled: Boolean(page.database), onRows: page.replaceLoadedRows })
    bridge.current = paged.bridge
    return { ...page, ...paged }
  }, { wrapper })
}
beforeEach(() => {
  vi.resetAllMocks()
  serverRows = [{ id: 'one', cells: { status: { value: 'todo' } } }, { id: 'two', cells: { status: { value: 'todo' } } }, { id: 'three', cells: { status: { value: 'done' } } }]
  api.load.mockImplementation(async () => ({ headerCols: columns, settings: { view }, rows: [] }))
  api.query.mockImplementation(async (_page: string, _view: string, input: PageViewQueryRequest) => projection(input))
})
afterEach(cleanup)
const rowIds = (hook: ReturnType<typeof setup>, lane: string) => hook.result.current.pagination.streams[`board:${lane}`]?.rows.map((row) => row.id)
const move = { rowId: 'one', selectColumnId: 'status', optionId: 'done', beforeId: 'three' }

describe('local React state shared by Board, writes and realtime', () => {
  it('moves immediately, rejects an old read and a socket echo, and reconciles without losing other cards', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toEqual(['one', 'two']))
    const stale = deferred<PageViewQueryProjection>(), write = deferred<{ orderRevision: number }>()
    const oldProjection = projection({ scope: { type: 'board', optionId: 'todo' } })
    api.query.mockImplementationOnce(() => stale.promise)
    act(() => hook.result.current.bridge.onResync())
    await waitFor(() => expect(api.query).toHaveBeenCalledTimes(2))
    api.move.mockReturnValueOnce(write.promise)
    let request!: Promise<void>
    act(() => { request = hook.result.current.handlers.onBoardMove('view', move) })
    expect(rowIds(hook, 'todo')).toEqual(['two'])
    expect(rowIds(hook, 'done')).toEqual(['one', 'three'])
    expect(hook.result.current.database?.rows.find((row) => row.id === 'one')?.cells.status?.value).toBe('done')
    act(() => hook.result.current.realtimeOptions.onEvent?.({ type: 'cell-updated', payload: { pageId: 'page', rowId: 'one', columnId: 'status', columnType: 'select', value: 'todo', updatedAt: '2026-10-08T12:00:00.000Z', originUserId: 'other' } }))
    await act(async () => { stale.resolve(oldProjection); await stale.promise })
    expect(rowIds(hook, 'todo')).toEqual(['two'])
    expect(rowIds(hook, 'done')).toEqual(['one', 'three'])
    serverRows = [{ id: 'two', cells: { status: { value: 'todo' } } }, { id: 'one', cells: { status: { value: 'done' } } }, serverRows[2]]
    await act(async () => { write.resolve({ orderRevision: 2 }); await request })
    await waitFor(() => expect(api.query.mock.calls.length).toBeGreaterThan(2))
    await waitFor(() => expect(rowIds(hook, 'done')).toEqual(['one', 'three']))
    expect(rowIds(hook, 'todo')).toEqual(['two'])
    expect(hook.result.current.database?.rows).toHaveLength(3)
  })

  it('rolls back only the failed move, keeping an unrelated realtime edit', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toHaveLength(2))
    const write = deferred<{ orderRevision: number }>()
    api.move.mockReturnValueOnce(write.promise)
    let request!: Promise<void>
    act(() => { request = hook.result.current.handlers.onBoardMove('view', move) })
    act(() => hook.result.current.realtimeOptions.onEvent?.({ type: 'row-updated', payload: { pageId: 'page', rowId: 'two', title: 'Updated remotely', updatedAt: '2026-10-08T12:00:00.000Z', originUserId: 'other' } }))
    await act(async () => { write.reject(new Error('Rejected')); await expect(request).rejects.toThrow('Rejected') })
    expect(rowIds(hook, 'todo')).toEqual(['one', 'two'])
    expect(rowIds(hook, 'done')).toEqual(['three'])
    expect(hook.result.current.pagination.streams['board:todo'].rows[1].cells.page_title?.value).toBe('Updated remotely')
  })

  it('previews a Flow before HTTP and confirms server values with the socket absent', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toHaveLength(2))
    const write = deferred<FlowExecutionResult>()
    api.execute.mockReturnValueOnce(write.promise)
    let request!: Promise<FlowExecutionResult>
    act(() => { request = hook.result.current.handlers.onFlowExecute({ rowId: 'one', columnId: 'flow' }) })
    expect(rowIds(hook, 'todo')).toEqual(['two'])
    expect(rowIds(hook, 'done')).toContain('one')
    await act(async () => { write.resolve({ executionId: 'exec', status: 'succeeded', startedAt: '', finishedAt: '', executedNodeIds: [], callback: null, effects: { valuesUpdated: 1, emailsQueued: 0 }, updatedValues: [{ columnId: 'status', value: 'done' }] }); await request })
    expect(hook.result.current.database?.rows.find((row) => row.id === 'one')?.cells.flow?.value).toMatchObject({ status: 'succeeded' })
    expect(rowIds(hook, 'done')).toContain('one')
  })

  it('rolls back a failed Flow instead of leaving the card in the preview lane', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toHaveLength(2))
    const write = deferred<FlowExecutionResult>()
    api.execute.mockReturnValueOnce(write.promise)
    let request!: Promise<FlowExecutionResult>
    act(() => { request = hook.result.current.handlers.onFlowExecute({ rowId: 'one', columnId: 'flow' }) })
    expect(rowIds(hook, 'done')).toContain('one')
    await act(async () => { write.reject(new Error('Flow failed')); await expect(request).rejects.toThrow('Flow failed') })
    expect(rowIds(hook, 'todo')).toContain('one')
    expect(rowIds(hook, 'done')).toEqual(['three'])
  })

  it('keeps the newer move when an older HTTP success arrives last', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toHaveLength(2))
    const first = deferred<{ orderRevision: number }>(), second = deferred<{ orderRevision: number }>()
    api.move.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let firstRequest!: Promise<void>, secondRequest!: Promise<void>
    act(() => {
      firstRequest = hook.result.current.handlers.onBoardMove('view', move)
      secondRequest = hook.result.current.handlers.onBoardMove('view', { ...move, optionId: 'todo', beforeId: 'two' })
    })
    expect(rowIds(hook, 'todo')).toEqual(['one', 'two'])
    await act(async () => { second.resolve({ orderRevision: 3 }); await secondRequest; first.resolve({ orderRevision: 2 }); await firstRequest })
    expect(rowIds(hook, 'todo')).toEqual(['one', 'two'])
    expect(rowIds(hook, 'done')).toEqual(['three'])
    expect(hook.result.current.database?.rows.find((row) => row.id === 'one')?.cells.status?.value).toBe('todo')
    expect(hook.result.current.bridge.orderRevision).toBe(3)
  })

  it('moves a loaded card immediately on a remote status event without a full reload', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toHaveLength(2))
    const unaffected = hook.result.current.pagination.streams['board:todo'].rows[1]
    act(() => hook.result.current.realtimeOptions.onEvent?.({ type: 'cell-updated', payload: { pageId: 'page', rowId: 'one', columnId: 'status', columnType: 'select', value: 'done', updatedAt: '2026-10-08T12:00:00.000Z', originUserId: 'other' } }))
    expect(rowIds(hook, 'todo')).toEqual(['two'])
    expect(rowIds(hook, 'done')).toContain('one')
    expect(hook.result.current.pagination.streams['board:todo'].rows[0]).toBe(unaffected)
    expect(api.load).toHaveBeenCalledOnce()
    expect(api.query).toHaveBeenCalledOnce()
  })

  it('does not undo a newer local reorder when an older order-only request fails', async () => {
    serverRows.push({ id: 'four', cells: { status: { value: 'todo' } } })
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toEqual(['one', 'two', 'four']))
    const first = deferred<{ orderRevision: number }>(), second = deferred<{ orderRevision: number }>()
    api.move.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    let firstRequest!: Promise<void>, secondRequest!: Promise<void>
    act(() => {
      firstRequest = hook.result.current.handlers.onRowMove('view', { rowId: 'one', afterId: 'four' })
      secondRequest = hook.result.current.handlers.onRowMove('view', { rowId: 'one', beforeId: 'four' })
    })
    expect(rowIds(hook, 'todo')).toEqual(['two', 'one', 'four'])
    await act(async () => { first.reject(new Error('Old order rejected')); await expect(firstRequest).rejects.toThrow('Old order rejected') })
    expect(rowIds(hook, 'todo')).toEqual(['two', 'one', 'four'])
    await act(async () => { second.resolve({ orderRevision: 2 }); await secondRequest })
    expect(rowIds(hook, 'todo')).toEqual(['two', 'one', 'four'])
  })

  it('keeps a remote edit and a local move delivered in the same React batch', async () => {
    const hook = setup()
    await waitFor(() => expect(rowIds(hook, 'todo')).toHaveLength(2))
    const write = deferred<{ orderRevision: number }>()
    api.move.mockReturnValueOnce(write.promise)
    let request!: Promise<void>
    act(() => {
      hook.result.current.realtimeOptions.onEvent?.({ type: 'row-updated', payload: { pageId: 'page', rowId: 'two', title: 'Remote title', updatedAt: '2026-10-08T12:00:00.000Z', originUserId: 'other' } })
      request = hook.result.current.handlers.onBoardMove('view', move)
    })
    expect(hook.result.current.database?.rows.find((row) => row.id === 'two')?.cells.page_title?.value).toBe('Remote title')
    expect(rowIds(hook, 'done')).toEqual(['one', 'three'])
    await act(async () => { write.resolve({ orderRevision: 2 }); await request })
  })
})
