import { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ParsedDatabase } from '@/lib/databaseParser'
import { FALLBACK_VIEW_ID } from '@/lib/databaseParser'
import { AppError } from '@/lib/errors'
import type { PageRealtimeChannel } from '@/services/PageRealtimeChannel'
import { usePageDatabase } from './usePageDatabase'

const dependencies = vi.hoisted(() => ({
  feedback: vi.fn(),
  loadPage: vi.fn(),
  changeColumnType: vi.fn(),
  renameColumn: vi.fn(),
  resetColumn: vi.fn(),
  saveColumnConfig: vi.fn(),
  saveCell: vi.fn(),
  saveViewSnapshot: vi.fn(),
  previewColumnResize: vi.fn(),
}))

vi.mock('@/contexts/FeedbackContext', () => ({
  useFeedback: () => dependencies.feedback,
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: { loadPage: dependencies.loadPage },
}))

vi.mock('@/services/PageWriteService', () => ({
  pageWriteService: {
    changeColumnType: dependencies.changeColumnType,
    renameColumn: dependencies.renameColumn,
    resetColumn: dependencies.resetColumn,
    saveColumnConfig: dependencies.saveColumnConfig,
    saveCell: dependencies.saveCell,
    saveViewSnapshot: dependencies.saveViewSnapshot,
  },
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
  dependencies.saveViewSnapshot.mockResolvedValue(undefined)
})

afterEach(() => cleanup())

describe('usePageDatabase — concorrência e ressincronização da célula', () => {
  it('coalesce ACK e eventos estruturais em uma carga ativa e um único follow-up', async () => {
    const first = deferred<ParsedDatabase>()
    const afterJoin = deferred<ParsedDatabase>()
    dependencies.loadPage
      .mockReset()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => afterJoin.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(1))

    act(() => {
      result.current.realtimeOptions.onResync?.()
      result.current.realtimeOptions.onStructureChanged?.({
        type: 'row-created',
        payload: {
          pageId: PAGE_ID,
          rowId: ROW_ID,
          updatedAt: '2026-08-30T12:00:00.000Z',
          originUserId: 'user-1',
        },
      })
      result.current.realtimeOptions.onStructureChanged?.({
        type: 'column-created',
        payload: {
          pageId: PAGE_ID,
          columnId: COLUMN_ID,
          updatedAt: '2026-08-30T12:00:00.001Z',
          originUserId: 'user-1',
        },
      })
    })
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)

    await act(async () => first.resolve(database('snapshot-antes-do-follow-up')))
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(2))

    await act(async () => afterJoin.resolve(database('autoritativo-após-join')))
    await waitFor(() =>
      expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe(
        'autoritativo-após-join',
      ),
    )
    expect(dependencies.loadPage).toHaveBeenCalledTimes(2)
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

describe('usePageDatabase — snapshot da view', () => {
  it('envia preview efêmero e o remove quando chega o snapshot confirmado', async () => {
    const viewId = '01KXVZ0000VIEW00000000001'
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        [viewId]: {
          view: 'table',
          name: 'Tabela',
          filters: '',
          orderedHeaderCols: [COLUMN_ID],
          columnWidths: { [COLUMN_ID]: 180 },
        },
      },
    })
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.realtimeOptions.onChannelChange?.({
        previewColumnResize: dependencies.previewColumnResize,
      } as unknown as PageRealtimeChannel)
      result.current.handlers.onColumnWidthPreview(viewId, COLUMN_ID, 320)
      result.current.realtimeOptions.onColumnResize?.({
        pageId: PAGE_ID,
        viewId,
        columnId: COLUMN_ID,
        width: 320,
        originUserId: '01KXVZ0000USER00000000001',
      })
    })

    expect(dependencies.previewColumnResize).toHaveBeenCalledWith({
      viewId,
      columnId: COLUMN_ID,
      width: 320,
    })
    expect(result.current.columnWidthPreviews).toEqual({ [viewId]: { [COLUMN_ID]: 320 } })

    act(() => {
      result.current.realtimeOptions.onEvent?.({
        type: 'view-updated',
        payload: {
          pageId: PAGE_ID,
          data: {
            [viewId]: {
              view: 'table',
              name: 'Tabela',
              filters: '',
              orderedHeaderCols: [COLUMN_ID],
              columnWidths: { [COLUMN_ID]: 300 },
            },
          },
          updatedAt: '2026-08-29T12:00:00.000Z',
          originUserId: '01KXVZ0000USER00000000001',
        },
      })
    })

    expect(result.current.columnWidthPreviews).toEqual({})
    expect(result.current.database?.settings[viewId].columnWidths).toEqual({ [COLUMN_ID]: 300 })
  })

  it('nunca envia a coluna title para as rotas genéricas de page_columns', async () => {
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onColumnRename('page_title', 'Outro nome')
      result.current.handlers.onColumnTypeChange('page_title', 'numeric')
      result.current.handlers.onColumnConfigChange('page_title', { mask: 'cpf' })
      result.current.handlers.onColumnReset('page_title')
    })

    expect(dependencies.renameColumn).not.toHaveBeenCalled()
    expect(dependencies.changeColumnType).not.toHaveBeenCalled()
    expect(dependencies.saveColumnConfig).not.toHaveBeenCalled()
    expect(dependencies.resetColumn).not.toHaveBeenCalled()
  })

  it('salva nome e máscara da coluna title no snapshot da view', async () => {
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        ['01KXVZ0000VIEW00000000001']: {
          view: 'table',
          name: 'Tabela',
          filters: '',
          title: { key: 'title', column_name: 'Título' },
          orderedHeaderCols: ['page_title', COLUMN_ID],
        },
      },
    })

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onPageTitleColumnChange('01KXVZ0000VIEW00000000001', {
        key: 'title',
        column_name: 'Docente',
        mask: 'cpf',
      })
    })

    expect(result.current.database?.settings['01KXVZ0000VIEW00000000001'].title).toEqual({
      key: 'title',
      column_name: 'Docente',
      mask: 'cpf',
    })
    await waitFor(() => expect(dependencies.saveViewSnapshot).toHaveBeenCalledTimes(1))
    expect(dependencies.saveViewSnapshot.mock.calls[0][3]).toEqual({
      title: { key: 'title', column_name: 'Docente', mask: 'cpf' },
    })
  })

  it('materializa o fallback e serializa drags rápidos sem perder o primeiro patch', async () => {
    const firstWrite = deferred<unknown>()
    dependencies.saveViewSnapshot
      .mockImplementationOnce(() => firstWrite.promise)
      .mockResolvedValueOnce(undefined)
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        [FALLBACK_VIEW_ID]: {
          view: 'table',
          name: 'Tabela',
          filters: '',
          orderedHeaderCols: [COLUMN_ID],
        },
      },
    })

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.handlers.onRowOrderChange(FALLBACK_VIEW_ID, ['row-2', ROW_ID])
      result.current.handlers.onColumnOrderChange(FALLBACK_VIEW_ID, ['page_title', COLUMN_ID])
    })

    const settings = result.current.database?.settings ?? {}
    const [materializedId] = Object.keys(settings)
    expect(materializedId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(materializedId).not.toBe(FALLBACK_VIEW_ID)
    expect(settings[materializedId]).toMatchObject({
      orderedRows: ['row-2', ROW_ID],
      orderedHeaderCols: ['page_title', COLUMN_ID],
    })

    await waitFor(() => expect(dependencies.saveViewSnapshot).toHaveBeenCalledTimes(1))
    expect(dependencies.saveViewSnapshot.mock.calls[0][2]).toBe(materializedId)
    expect(dependencies.saveViewSnapshot.mock.calls[0][3]).toEqual({
      orderedRows: ['row-2', ROW_ID],
    })

    // O segundo PUT não ultrapassa o primeiro, e sua base já carrega a ordem
    // de linhas — portanto não pode apagá-la ao salvar a ordem de colunas.
    expect(dependencies.saveViewSnapshot).toHaveBeenCalledTimes(1)
    firstWrite.resolve(undefined)
    await waitFor(() => expect(dependencies.saveViewSnapshot).toHaveBeenCalledTimes(2))
    expect(dependencies.saveViewSnapshot.mock.calls[1][1][materializedId]).toMatchObject({
      orderedRows: ['row-2', ROW_ID],
    })
    expect(dependencies.saveViewSnapshot.mock.calls[1][3]).toEqual({
      orderedHeaderCols: ['page_title', COLUMN_ID],
    })
  })
})
