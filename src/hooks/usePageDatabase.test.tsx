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
  createRow: vi.fn(),
  createColumn: vi.fn(),
  deleteRow: vi.fn(),
  deleteColumn: vi.fn(),
  changeColumnType: vi.fn(),
  renameColumn: vi.fn(),
  resetColumn: vi.fn(),
  saveColumnConfig: vi.fn(),
  saveCell: vi.fn(),
  createView: vi.fn(),
  duplicateView: vi.fn(),
  deleteView: vi.fn(),
  patchView: vi.fn(),
  saveViewFilters: vi.fn(),
  reconcileFilterKeys: vi.fn(),
  previewColumnResize: vi.fn(),
}))

vi.mock('@/contexts/FeedbackContext', () => ({
  useFeedback: () => dependencies.feedback,
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: {
    loadPage: dependencies.loadPage,
    reconcileFilterKeys: dependencies.reconcileFilterKeys,
  },
}))

vi.mock('@/services/PageWriteService', () => ({
  pageWriteService: {
    createRow: dependencies.createRow,
    createColumn: dependencies.createColumn,
    deleteRow: dependencies.deleteRow,
    deleteColumn: dependencies.deleteColumn,
    changeColumnType: dependencies.changeColumnType,
    renameColumn: dependencies.renameColumn,
    resetColumn: dependencies.resetColumn,
    saveColumnConfig: dependencies.saveColumnConfig,
    saveCell: dependencies.saveCell,
    createView: dependencies.createView,
    duplicateView: dependencies.duplicateView,
    deleteView: dependencies.deleteView,
    patchView: dependencies.patchView,
    saveViewFilters: dependencies.saveViewFilters,
  },
}))

vi.mock('@/lib/i18n', () => ({ i18n: (key: string) => key }))

const PAGE_ID = '01KXVZ0000PARENT0000000001'
const OTHER_PAGE_ID = '01KXVZ0000PARENT0000000002'
const ROW_ID = '01KXVZ0000ROW000000000001'
const NEW_ROW_ID = '01KXVZ0000ROW000000000002'
const COLUMN_ID = '01KXVZ0000COLUMN00000001'
const NEW_COLUMN_ID = '01KXVZ0000COLUMN00000002'

const emptyFilters = () => ({
  version: 2 as const,
  updatedAt: null,
  clauses: [],
  groupBy: [],
  passthrough: [],
})

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
  dependencies.createRow.mockResolvedValue({
    id: NEW_ROW_ID,
    title: null,
    data: {},
    owner_id: '01KXVZ0000USER00000000001',
    created_at: '2026-09-02 01:00:00',
    updated_at: '2026-09-02 01:00:00',
  })
  dependencies.createColumn.mockResolvedValue({
    id: NEW_COLUMN_ID,
    parent_id: PAGE_ID,
    name: 'Coluna',
    type: 'text',
    data: { publicKey: { key: 'coluna', aliases: [] } },
  })
  dependencies.deleteRow.mockResolvedValue(undefined)
  dependencies.deleteColumn.mockResolvedValue(undefined)
  dependencies.patchView.mockResolvedValue(undefined)
  dependencies.deleteView.mockResolvedValue(undefined)
  dependencies.saveViewFilters.mockImplementation(
    (_pageId, _viewId, filters) => Promise.resolve({ viewId: _viewId, filters }),
  )
  dependencies.reconcileFilterKeys.mockResolvedValue({ settings: {}, headerCols: [] })
})

afterEach(() => cleanup())

describe('usePageDatabase — identidade da rota', () => {
  it('carrega a base usando exatamente o pageId recebido pela rota', async () => {
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
    expect(dependencies.loadPage).toHaveBeenCalledWith(PAGE_ID)
  })

  it('mantém uma página-folha válida como database vazia, não como falha', async () => {
    dependencies.loadPage.mockResolvedValueOnce({ ...database('folha'), rows: [] })
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.failed).toBe(false)
    expect(result.current.database?.rows).toEqual([])
  })

  it('marca falha HTTP separadamente de uma resposta vazia', async () => {
    dependencies.loadPage.mockRejectedValueOnce(new Error('falha HTTP'))
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.failed).toBe(true)
    expect(result.current.database).toBeNull()
  })
})

describe('usePageDatabase — criação de página-linha', () => {
  it('deduplica o eco row-created sem refetch e deixa a primeira edição como célula ausente', async () => {
    const createRequest = deferred<{
      id: string
      title: null
      data: Record<string, unknown>
      owner_id: string
      created_at: string
      updated_at: string
    }>()
    dependencies.createRow.mockReturnValueOnce(createRequest.promise)
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => result.current.handlers.onAddRow())

    await waitFor(() => expect(dependencies.createRow).toHaveBeenCalledWith(PAGE_ID))
    // O backend publica antes de encerrar a resposta HTTP. Esse eco já insere
    // a filha e não pode disparar a antiga recarga da base inteira.
    act(() => {
      result.current.realtimeOptions.onStructureChanged?.({
        type: 'row-created',
        payload: {
          pageId: PAGE_ID,
          rowId: NEW_ROW_ID,
          updatedAt: '2026-09-02T01:00:00.000Z',
          originUserId: '01KXVZ0000USER00000000001',
        },
      })
    })
    await waitFor(() =>
      expect(result.current.database?.rows.find((row) => row.id === NEW_ROW_ID)).toEqual({
        id: NEW_ROW_ID,
        cells: {},
      }),
    )
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)

    await act(async () =>
      createRequest.resolve({
        id: NEW_ROW_ID,
        title: null,
        data: {},
        owner_id: '01KXVZ0000USER00000000001',
        created_at: '2026-09-02 01:00:00',
        updated_at: '2026-09-02 01:00:00',
      }),
    )
    expect(result.current.database?.rows.filter((row) => row.id === NEW_ROW_ID)).toHaveLength(1)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.handlers.onCellChange({
        rowId: NEW_ROW_ID,
        columnId: COLUMN_ID,
        value: 'primeiro valor',
        previousValue: undefined,
      })
    })
    await flushMutation()

    expect(dependencies.saveCell).toHaveBeenCalledWith({
      rowId: NEW_ROW_ID,
      columnId: COLUMN_ID,
      value: 'primeiro valor',
      previousValue: undefined,
    })
  })

  it('aplica a criação remota e a edição seguinte somente sobre a nova linha', async () => {
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.realtimeOptions.onStructureChanged?.({
        type: 'row-created',
        payload: {
          pageId: PAGE_ID,
          rowId: NEW_ROW_ID,
          updatedAt: '2026-09-02T01:00:00.000Z',
          originUserId: 'outro-usuario',
        },
      })
      result.current.realtimeOptions.onEvent?.({
        type: 'cell-updated',
        payload: {
          pageId: PAGE_ID,
          rowId: NEW_ROW_ID,
          columnId: COLUMN_ID,
          value: 'valor remoto',
          updatedAt: '2026-09-02T01:00:00.001Z',
          originUserId: 'outro-usuario',
        },
      })
    })

    expect(result.current.database?.rows.find((row) => row.id === NEW_ROW_ID)).toEqual({
      id: NEW_ROW_ID,
      cells: { [COLUMN_ID]: { value: 'valor remoto' } },
    })
    expect(result.current.loading).toBe(false)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })
})

describe('usePageDatabase — título da página aberta', () => {
  it('atualiza o pageTitle do renderer e não deixa evento ou resync antigo vencê-lo', async () => {
    const staleResync = deferred<ParsedDatabase>()
    dependencies.loadPage
      .mockResolvedValueOnce({ ...database('inicial'), pageTitle: 'teste · realtime' })
      .mockReturnValueOnce(staleResync.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database?.pageTitle).toBe('teste · realtime'))

    act(() => result.current.realtimeOptions.onResync?.())
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(2))

    act(() => {
      result.current.realtimeOptions.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'teste',
        updatedAt: '2026-09-15T12:00:00.000Z',
        originUserId: 'outro-usuario',
      })
      result.current.realtimeOptions.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'evento atrasado',
        updatedAt: '2026-09-15T11:59:59.999Z',
        originUserId: 'outro-usuario',
      })
      result.current.realtimeOptions.onPageUpdated?.({
        pageId: OTHER_PAGE_ID,
        title: 'outra página',
        updatedAt: '2026-09-15T13:00:00.000Z',
        originUserId: 'outro-usuario',
      })
      result.current.realtimeOptions.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'teste no mesmo milissegundo',
        updatedAt: '2026-09-15T12:00:00.000Z',
        originUserId: 'outro-usuario',
      })
    })

    expect(result.current.database?.pageTitle).toBe('teste no mesmo milissegundo')

    await act(async () => {
      staleResync.resolve({ ...database('snapshot antigo'), pageTitle: 'teste · realtime' })
    })
    expect(result.current.database?.pageTitle).toBe('teste no mesmo milissegundo')
  })
})

describe('usePageDatabase — criação de coluna', () => {
  it('mescla resposta e eco sem refetch, sem duplicar e sem criar células', async () => {
    const createRequest = deferred<{
      id: string
      parent_id: string
      name: string
      type: 'text'
      data: { publicKey: { key: string; aliases: string[] } }
    }>()
    dependencies.createColumn.mockReturnValueOnce(createRequest.promise)
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => result.current.handlers.onAddColumn())
    expect(dependencies.createColumn).toHaveBeenCalledWith(
      PAGE_ID,
      'pages.app.cubs-database.nova-coluna',
    )

    const column = {
      id: NEW_COLUMN_ID,
      parent_id: PAGE_ID,
      name: 'Coluna',
      type: 'text' as const,
      data: { publicKey: { key: 'coluna', aliases: [] } },
    }
    act(() => {
      result.current.realtimeOptions.onEvent?.({
        type: 'column-created',
        payload: {
          pageId: PAGE_ID,
          columnId: NEW_COLUMN_ID,
          column,
          updatedAt: '2026-09-03T12:00:00.000Z',
          originUserId: 'user-1',
        },
      })
    })

    expect(result.current.database?.headerCols.at(-1)?.title).toBe('Coluna')
    expect(result.current.database?.rows[0].cells[NEW_COLUMN_ID]).toBeUndefined()
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)

    await act(async () => createRequest.resolve(column))
    expect(result.current.database?.headerCols.filter(({ id }) => id === NEW_COLUMN_ID)).toHaveLength(1)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })
})

describe('usePageDatabase — lixeira otimista', () => {
  it('remove a página imediatamente e trata o próprio row-deleted como eco idempotente', async () => {
    const request = deferred<unknown>()
    dependencies.deleteRow.mockReturnValueOnce(request.promise)
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => result.current.handlers.onDeleteRow(ROW_ID))
    expect(result.current.database?.rows).toHaveLength(0)
    await waitFor(() => expect(dependencies.deleteRow).toHaveBeenCalledWith(ROW_ID))

    act(() => {
      result.current.realtimeOptions.onStructureChanged?.({
        type: 'row-deleted',
        payload: {
          pageId: PAGE_ID,
          rowId: ROW_ID,
          updatedAt: '2026-09-07T18:00:00.000Z',
          originUserId: 'eu',
        },
      })
    })
    expect(result.current.database?.rows).toHaveLength(0)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)

    await act(async () => request.resolve(undefined))
  })

  it('restaura somente a página removida quando o soft delete falha', async () => {
    dependencies.deleteRow.mockRejectedValueOnce(new AppError('api', 'falhou', { status: 500 }))
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => result.current.handlers.onDeleteRow(ROW_ID))
    expect(result.current.database?.rows).toHaveLength(0)
    await waitFor(() => expect(dependencies.feedback).toHaveBeenCalledTimes(1))

    expect(result.current.database?.rows[0].id).toBe(ROW_ID)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })

  it('remove coluna e células sem reload e restaura ambas quando a escrita falha', async () => {
    const request = deferred<unknown>()
    dependencies.deleteColumn.mockReturnValueOnce(request.promise)
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => result.current.handlers.onColumnDelete(COLUMN_ID))
    expect(result.current.database?.headerCols).toHaveLength(0)
    expect(result.current.database?.rows[0].cells[COLUMN_ID]).toBeUndefined()
    await waitFor(() =>
      expect(dependencies.deleteColumn).toHaveBeenCalledWith(PAGE_ID, COLUMN_ID),
    )
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)

    request.reject(new AppError('api', 'falhou', { status: 500 }))
    await waitFor(() => expect(dependencies.feedback).toHaveBeenCalledTimes(1))
    expect(result.current.database?.headerCols[0].id).toBe(COLUMN_ID)
    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('inicial')
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })

  it('aplica column-deleted remoto incrementalmente sem desmontar a base', async () => {
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => {
      result.current.realtimeOptions.onStructureChanged?.({
        type: 'column-deleted',
        payload: {
          pageId: PAGE_ID,
          columnId: COLUMN_ID,
          updatedAt: '2026-09-07T18:00:00.000Z',
          originUserId: 'outro',
        },
      })
    })

    expect(result.current.database?.headerCols).toHaveLength(0)
    expect(result.current.database?.rows[0].cells[COLUMN_ID]).toBeUndefined()
    expect(result.current.loading).toBe(false)
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })
})

describe('usePageDatabase — concorrência e ressincronização da célula', () => {
  it('mantém o snapshot visível durante um resync de background', async () => {
    const background = deferred<ParsedDatabase>()
    dependencies.loadPage
      .mockResolvedValueOnce(database('inicial'))
      .mockImplementationOnce(() => background.promise)

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.realtimeOptions.onResync?.())
    await waitFor(() => expect(dependencies.loadPage).toHaveBeenCalledTimes(2))

    expect(result.current.loading).toBe(false)
    expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('inicial')

    await act(async () => background.resolve(database('ressincronizado')))
    await waitFor(() =>
      expect(result.current.database?.rows[0].cells[COLUMN_ID]?.value).toBe('ressincronizado'),
    )
    expect(result.current.loading).toBe(false)
  })

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
        type: 'column-deleted',
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
  it('duplica e remove a view na coleção local após confirmação HTTP', async () => {
    const originalId = '01KXVZ0000VIEW00000000001'
    const copyId = '01KXVZ0000VIEW00000000002'
    const original = { view: 'board' as const, name: 'Quadros', urlKey: { key: 'quadros', aliases: [] }, filters: emptyFilters(), orderedHeaderCols: [COLUMN_ID] }
    const copy = { ...original, name: 'Quadros (cópia)', urlKey: { key: 'quadros_copia', aliases: [] } }
    dependencies.loadPage.mockResolvedValueOnce({ ...database('inicial'), settings: { [originalId]: original } })
    dependencies.duplicateView.mockResolvedValueOnce({ viewId: copyId, view: copy })
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    let createdId = ''
    await act(async () => { createdId = await result.current.handlers.onDuplicateView(originalId) })
    expect(createdId).toBe(copyId)
    expect(dependencies.duplicateView).toHaveBeenCalledWith(PAGE_ID, originalId)
    expect(result.current.database?.settings).toEqual({ [originalId]: original, [copyId]: copy })

    await act(async () => { await result.current.handlers.onDeleteView(originalId) })
    expect(dependencies.deleteView).toHaveBeenCalledWith(PAGE_ID, originalId)
    expect(result.current.database?.settings).toEqual({ [copyId]: copy })
  })

  it('adiciona uma view sem substituir a view existente', async () => {
    const oldId = '01KXVZ0000VIEW00000000001'
    const newId = '01KXVZ0000VIEW00000000002'
    const oldView = {
      view: 'table' as const,
      name: 'Principal',
      urlKey: { key: 'principal', aliases: [] },
      filters: emptyFilters(),
      orderedHeaderCols: [],
    }
    const newView = {
      ...oldView,
      view: 'calendar' as const,
      name: 'pages.app.cubs-database.views.calendar',
      urlKey: { key: 'calendar', aliases: [] },
    }
    dependencies.loadPage.mockResolvedValueOnce({ ...database('inicial'), settings: { [oldId]: oldView } })
    dependencies.createView.mockResolvedValueOnce({ viewId: newId, view: newView })
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    let created = ''
    await act(async () => { created = await result.current.handlers.onAddView('calendar', oldId) })

    expect(created).toBe(newId)
    expect(dependencies.createView).toHaveBeenCalledWith(
      PAGE_ID, 'calendar', 'pages.app.cubs-database.views.calendar', undefined,
    )
    expect(result.current.database?.settings).toEqual({ [oldId]: oldView, [newId]: newView })
  })

  it('preserva a tabela fallback ao adicionar a primeira view diferente', async () => {
    const defaultId = '01KXVZ0000VIEW00000000003'
    const newId = '01KXVZ0000VIEW00000000004'
    const fallback = {
      view: 'table' as const,
      name: 'Tabela',
      urlKey: { key: 'tabela', aliases: [] },
      filters: emptyFilters(),
      orderedHeaderCols: [],
    }
    const calendar = { ...fallback, view: 'calendar' as const, name: 'Calendário' }
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'), settings: { [FALLBACK_VIEW_ID]: fallback },
    })
    dependencies.createView
      .mockResolvedValueOnce({ viewId: defaultId, view: fallback })
      .mockResolvedValueOnce({ viewId: newId, view: calendar })
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    await act(async () => { await result.current.handlers.onAddView('calendar', FALLBACK_VIEW_ID) })

    expect(dependencies.createView).toHaveBeenCalledTimes(2)
    expect(dependencies.createView.mock.calls[0]?.slice(0, 3)).toEqual([PAGE_ID, 'table', 'Tabela'])
    expect(dependencies.createView.mock.calls[1]?.slice(0, 3)).toEqual([
      PAGE_ID, 'calendar', 'pages.app.cubs-database.views.calendar',
    ])
    expect(result.current.database?.settings[FALLBACK_VIEW_ID]).toBeUndefined()
    expect(result.current.database?.settings[defaultId]).toEqual(fallback)
    expect(result.current.database?.settings[newId]).toEqual(calendar)
  })

  it('salva filtros pelo endpoint atômico e adota o timestamp do servidor', async () => {
    const viewId = '01KXVZ0000VIEW00000000001'
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        [viewId]: {
          view: 'table',
          name: 'Tabela',
          urlKey: { key: 'tabela', aliases: [] },
          filters: emptyFilters(),
          orderedHeaderCols: [COLUMN_ID],
        },
      },
    })
    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    const filters = { ...emptyFilters(), groupBy: [COLUMN_ID] }
    const confirmed = { ...filters, updatedAt: '2026-09-01T17:00:00.000Z' }
    dependencies.saveViewFilters.mockResolvedValueOnce({ viewId, filters: confirmed })
    await act(async () => {
      await result.current.handlers.onViewFiltersChange(viewId, filters)
    })

    expect(dependencies.saveViewFilters).toHaveBeenCalledWith(PAGE_ID, viewId, filters)
    expect(result.current.database?.settings[viewId].filters).toEqual(confirmed)
  })

  it('envia preview efêmero e o remove quando chega o snapshot confirmado', async () => {
    const viewId = '01KXVZ0000VIEW00000000001'
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        [viewId]: {
          view: 'table',
          name: 'Tabela',
          urlKey: { key: 'tabela', aliases: [] },
          filters: emptyFilters(),
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
              urlKey: { key: 'tabela', aliases: [] },
              filters: emptyFilters(),
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
          urlKey: { key: 'tabela', aliases: [] },
          filters: emptyFilters(),
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
    await waitFor(() => expect(dependencies.patchView).toHaveBeenCalledTimes(1))
    expect(dependencies.patchView.mock.calls[0][2]).toEqual({
      title: { key: 'title', column_name: 'Docente', mask: 'cpf' },
    })
  })

  it('troca a projeção da view otimisticamente e persiste somente seu tipo', async () => {
    const viewId = '01KXVZ0000VIEW00000000001'
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        [viewId]: {
          view: 'table',
          name: 'Tabela',
          urlKey: { key: 'tabela', aliases: [] },
          filters: emptyFilters(),
          orderedHeaderCols: [COLUMN_ID],
        },
      },
    })

    const { result } = renderHook(() => usePageDatabase(PAGE_ID), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.database).not.toBeNull())

    act(() => result.current.handlers.onViewKindChange(viewId, 'timeline'))

    expect(result.current.database?.settings[viewId].view).toBe('timeline')
    await waitFor(() => expect(dependencies.patchView).toHaveBeenCalledTimes(1))
    expect(dependencies.patchView).toHaveBeenCalledWith(PAGE_ID, viewId, {
      view: 'timeline',
    })
    expect(dependencies.loadPage).toHaveBeenCalledTimes(1)
  })

  it('materializa o fallback por POST e serializa drags sem reescrever o snapshot', async () => {
    const materializedId = '01KXVZ0000VIEW00000000009'
    let serverView: ParsedDatabase['settings'][string] = {
      view: 'table', name: 'Tabela', urlKey: { key: 'tabela', aliases: [] },
      filters: emptyFilters(), orderedHeaderCols: [COLUMN_ID],
    }
    const firstWrite = deferred<{ viewId: string; view: typeof serverView }>()
    dependencies.createView.mockImplementationOnce(() => firstWrite.promise)
    dependencies.patchView.mockImplementation(async (_pageId, viewId, patch) => {
      serverView = { ...serverView, ...patch }
      return { viewId, view: serverView }
    })
    dependencies.loadPage.mockResolvedValueOnce({
      ...database('inicial'),
      settings: {
        [FALLBACK_VIEW_ID]: {
          view: 'table',
          name: 'Tabela',
          urlKey: { key: 'tabela', aliases: [] },
          filters: emptyFilters(),
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

    await waitFor(() => expect(dependencies.createView).toHaveBeenCalledTimes(1))
    expect(dependencies.patchView).not.toHaveBeenCalled()
    firstWrite.resolve({ viewId: materializedId, view: serverView })
    await waitFor(() => expect(dependencies.patchView).toHaveBeenCalledTimes(2))
    expect(dependencies.patchView.mock.calls.map((call) => call[2])).toEqual([
      { orderedRows: ['row-2', ROW_ID] },
      { orderedHeaderCols: ['page_title', COLUMN_ID] },
    ])
    expect(result.current.database?.settings[materializedId]).toMatchObject({
      orderedRows: ['row-2', ROW_ID], orderedHeaderCols: ['page_title', COLUMN_ID],
    })
  })
})
