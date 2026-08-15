import { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ParsedDatabase } from '@/lib/databaseParser'
import { AppError } from '@/lib/errors'
import { usePageDatabase } from './usePageDatabase'

const dependencies = vi.hoisted(() => ({
  feedback: vi.fn(),
  loadPage: vi.fn(),
  saveCell: vi.fn(),
}))

vi.mock('@/contexts/FeedbackContext', () => ({
  useFeedback: () => dependencies.feedback,
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: { loadPage: dependencies.loadPage },
}))

vi.mock('@/services/PageWriteService', () => ({
  pageWriteService: { saveCell: dependencies.saveCell },
}))

vi.mock('@/lib/i18n', () => ({ i18n: (key: string) => key }))

const PAGE_ID = '01KXVZ0000PARENT0000000001'
const ROW_ID = '01KXVZ0000ROW000000000001'
const COLUMN_ID = '01KXVZ0000COLUMN00000001'

function database(value: string): ParsedDatabase {
  return {
    settings: {},
    headerCols: [{ id: COLUMN_ID, title: 'Texto', type: 'text' }],
    rows: [{ id: ROW_ID, cells: { [COLUMN_ID]: { value } } }],
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, reject, resolve }
}

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

async function flushMutation() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  dependencies.loadPage.mockResolvedValue(database('inicial'))
})

afterEach(() => cleanup())

describe('usePageDatabase — concorrência e ressincronização da célula', () => {
  it('uma resposta de load antiga não apaga o snapshot mais novo após o ACK', async () => {
    const first = deferred<ParsedDatabase>()
    const afterJoin = deferred<ParsedDatabase>()
    dependencies.loadPage
      .mockReset()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => afterJoin.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(1))

    act(() => result.current.realtimeOptions.onResync?.())
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(2))

    await act(async () => afterJoin.resolve(database('autoritativo-após-join')))
    await waitFor(() =>
      expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
        'autoritativo-após-join',
      ),
    )

    await act(async () => first.resolve(database('snapshot-antigo')))
    await flushMutation()

    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
      'autoritativo-após-join',
    )
  })

  it('um evento recebido durante reload invalida o snapshot stale em voo', async () => {
    const staleReload = deferred<ParsedDatabase>()
    dependencies.loadPage
      .mockResolvedValueOnce(database('inicial'))
      .mockImplementationOnce(() => staleReload.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() =>
      expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('inicial'),
    )

    act(() => result.current.realtimeOptions.onResync?.())
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(2))

    act(() => {
      result.current.realtimeOptions.onEvent?.({
        type: 'cell-updated',
        payload: {
          pageId: PAGE_ID,
          rowId: ROW_ID,
          columnId: COLUMN_ID,
          value: 'evento-durante-reload',
          updatedAt: '2026-08-15T20:00:00.000Z',
          originUserId: 'outro-usuario',
        },
      })
    })
    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
      'evento-durante-reload',
    )

    await act(async () => staleReload.resolve(database('snapshot-stale')))
    await flushMutation()

    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
      'evento-durante-reload',
    )
  })

  it('o impasse realtime marca a célula e invalida rollback HTTP antigo', async () => {
    const request = deferred<unknown>()
    dependencies.saveCell.mockImplementationOnce(() => request.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onCellChange({
        rowId: ROW_ID,
        columnId: COLUMN_ID,
        value: 'otimista-em-voo',
        previousValue: 'inicial',
      })
    })
    await waitFor(() => expect(dependencies.saveCell).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.realtimeOptions.onEvent?.({
        type: 'cell-updated',
        payload: {
          pageId: PAGE_ID,
          rowId: ROW_ID,
          columnId: COLUMN_ID,
          value: 'autoritativo-remoto',
          updatedAt: '2026-08-15T20:00:00.000Z',
          originUserId: 'outro-usuario',
        },
      })
      // Callback disparado pelo editor ao perder o draft/foco por causa da
      // mudança de prop acima.
      result.current.handlers.onCellEditConflict({
        rowId: ROW_ID,
        columnId: COLUMN_ID,
        columnTitle: 'Texto',
        value: 'autoritativo-remoto',
        displayValue: 'autoritativo-remoto',
      })
    })

    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
      'autoritativo-remoto',
    )
    expect(result.current.cellErrors).toContain(`${ROW_ID}:${COLUMN_ID}`)
    expect(dependencies.feedback).toHaveBeenCalledWith({
      title: 'feedback.realtime.titulo',
      description: 'feedback.realtime.edicao-interrompida',
      variant: 'warning',
    })

    request.reject(new AppError('api', 'falha antiga', { status: 500 }))
    await flushMutation()

    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
      'autoritativo-remoto',
    )
    expect(dependencies.feedback).toHaveBeenCalledTimes(1)
  })

  it('uma falha antiga não desfaz nem marca uma edição mais nova da mesma célula', async () => {
    const first = deferred<unknown>()
    const second = deferred<unknown>()
    dependencies.saveCell
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onCellChange({
        rowId: ROW_ID,
        columnId: COLUMN_ID,
        value: 'primeira',
        previousValue: 'inicial',
      })
    })
    await waitFor(() => expect(dependencies.saveCell).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.handlers.onCellChange({
        rowId: ROW_ID,
        columnId: COLUMN_ID,
        value: 'mais nova',
        previousValue: 'primeira',
      })
    })
    await waitFor(() => expect(dependencies.saveCell).toHaveBeenCalledTimes(2))

    first.reject(new AppError('api', 'falha antiga', { status: 500 }))
    await flushMutation()

    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('mais nova')
    expect(result.current.cellErrors).not.toContain(`${ROW_ID}:${COLUMN_ID}`)
    expect(dependencies.feedback).not.toHaveBeenCalled()

    second.resolve(null)
    await flushMutation()
  })

  it('a falha mais nova ainda reverte e marca a célula', async () => {
    const request = deferred<unknown>()
    dependencies.saveCell.mockImplementationOnce(() => request.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onCellChange({
        rowId: ROW_ID,
        columnId: COLUMN_ID,
        value: 'otimista',
        previousValue: 'inicial',
      })
    })
    await waitFor(() => expect(dependencies.saveCell).toHaveBeenCalledTimes(1))

    request.reject(new AppError('api', 'falhou', { status: 500 }))
    await waitFor(() => expect(dependencies.feedback).toHaveBeenCalledTimes(1))

    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('inicial')
    expect(result.current.cellErrors).toContain(`${ROW_ID}:${COLUMN_ID}`)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })

  it.each([404, 409])('recarrega a base após erro %s da edição mais nova', async (status) => {
    dependencies.loadPage
      .mockResolvedValueOnce(database('inicial'))
      .mockResolvedValueOnce(database('autoritativo'))
    dependencies.saveCell.mockRejectedValueOnce(
      new AppError('api', `falha ${status}`, { status }),
    )

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onCellChange({
        rowId: ROW_ID,
        columnId: COLUMN_ID,
        value: 'otimista',
        previousValue: 'inicial',
      })
    })

    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('autoritativo'),
    )
  })
})
