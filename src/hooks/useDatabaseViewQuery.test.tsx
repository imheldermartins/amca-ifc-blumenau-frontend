import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DataViewSettings,
  HeaderCol,
  ViewFiltersV2,
} from 'cubs-database'

import { useDatabaseViewQuery } from './useDatabaseViewQuery'

const queryState = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
  replaceNamespace: vi.fn(),
}))

vi.mock('@/hooks/useQueryParams', () => ({
  useQueryParams: () => ({
    all: queryState.values,
    get: (key: string) => queryState.values[key],
    getAll: (key: string) => {
      const value = queryState.values[key]
      return (Array.isArray(value) ? value : value === undefined ? [] : [value]).map(String)
    },
    has: (key: string) => queryState.values[key] !== undefined,
    set: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    reset: vi.fn(),
    clear: vi.fn(),
    replaceNamespace: queryState.replaceNamespace,
  }),
}))

const VIEW_A = '01KXVZ0000VIEW00000000001'
const VIEW_B = '01KXVZ0000VIEW00000000002'
const AREA = '01KXVZ0000COLUMN000000001'
const STATUS = '01KXVZ0000COLUMN000000002'
const EMAIL = '01KXVZ0000COLUMN000000003'
const ACTIVE = '01KXVZ0000OPTION000000001'

const COLUMNS: HeaderCol[] = [
  {
    id: 'page_title',
    key: 'title',
    title: 'Nome',
    type: 'text',
    publicKey: { key: 'nome', aliases: [] },
  },
  {
    id: AREA,
    title: 'Área',
    type: 'text',
    publicKey: { key: 'area', aliases: ['departamento'] },
  },
  {
    id: STATUS,
    title: 'Status',
    type: 'select',
    publicKey: { key: 'status', aliases: [] },
    options: [
      {
        id: ACTIVE,
        label: 'Ativo',
        publicKey: { key: 'ativo', aliases: [] },
      },
    ],
  },
  {
    id: EMAIL,
    title: 'E-mail',
    type: 'text',
    publicKey: { key: 'email', aliases: [] },
  },
]

function document(
  groupBy: string[] = [],
  updatedAt: string | null = '2026-09-01T10:00:00.000Z',
): ViewFiltersV2 {
  return { version: 2, updatedAt, clauses: [], groupBy, passthrough: [] }
}

function makeSettings(
  filtersA = document([AREA]),
  filtersB = document([]),
): DataViewSettings {
  return {
    [VIEW_A]: {
      view: 'table',
      name: 'Tabela',
      urlKey: { key: 'tabela', aliases: ['docentes'] },
      filters: filtersA,
      orderedHeaderCols: [],
      title: {
        key: 'title',
        column_name: 'Nome',
        publicKey: { key: 'nome', aliases: [] },
      },
    },
    [VIEW_B]: {
      view: 'table',
      name: 'Outra',
      urlKey: { key: 'outra', aliases: [] },
      filters: filtersB,
      orderedHeaderCols: [],
    },
  }
}

interface ProbeProps {
  settings?: DataViewSettings
  columns?: HeaderCol[]
  scopeKey?: string
  onPersist: (
    viewId: string,
    filters: ViewFiltersV2,
  ) => void | ViewFiltersV2 | Promise<void | ViewFiltersV2>
}

function Probe({
  settings = makeSettings(),
  columns = COLUMNS,
  scopeKey = 'page-1',
  onPersist,
}: ProbeProps) {
  const state = useDatabaseViewQuery({
    settings,
    columns,
    preferredViewId: VIEW_B,
    scopeKey,
    onPersistFilters: onPersist,
  })
  return (
    <>
      <output data-testid="active">{state.activeViewId}</output>
      <output data-testid="groups">{state.effectiveFilters.groupBy.join(',')}</output>
      <output data-testid="clauses">{JSON.stringify(state.effectiveFilters.clauses)}</output>
      <output data-testid="updated">{state.effectiveFilters.updatedAt ?? ''}</output>
      <output data-testid="conflict">{String(state.conflict)}</output>
      <output data-testid="status">{state.sync.status}</output>
      <output data-testid="diagnostics">{JSON.stringify(state.diagnostics)}</output>
      <button type="button" onClick={state.acceptPersistence}>Sim</button>
      <button type="button" onClick={state.rejectPersistence}>Não</button>
      <button
        type="button"
        onClick={() => state.changeLocal(state.activeViewId, document([EMAIL], null))}
      >
        Alterar
      </button>
      <button type="button" onClick={state.sync.applyRemote}>Atualizar</button>
      <button type="button" onClick={state.sync.retry}>Tentar novamente</button>
      <button type="button" onClick={() => state.changeView(VIEW_A)}>View A</button>
    </>
  )
}

beforeEach(() => {
  queryState.values = {}
  queryState.replaceNamespace.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useDatabaseViewQuery', () => {
  it('usa keys legíveis da URL como estado soberano e Não evita somente o PUT', () => {
    const onPersist = vi.fn()
    queryState.values = { keep: 'yes', view: 'tabela', fv: 2, group: 'status' }
    render(<Probe onPersist={onPersist} />)

    expect(screen.getByTestId('active').textContent).toBe(VIEW_A)
    expect(screen.getByTestId('groups').textContent).toBe(STATUS)
    expect(screen.getByTestId('conflict').textContent).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Não' }))
    expect(screen.getByTestId('conflict').textContent).toBe('false')
    expect(screen.getByTestId('groups').textContent).toBe(STATUS)
    expect(onPersist).not.toHaveBeenCalled()
  })

  it('aceita alias antigo e pede canonicalização com replace', async () => {
    queryState.values = { view: 'docentes', fv: 2, group: 'departamento' }
    render(<Probe onPersist={() => undefined} />)

    expect(screen.getByTestId('active').textContent).toBe(VIEW_A)
    expect(screen.getByTestId('groups').textContent).toBe(AREA)
    await waitFor(() => {
      expect(queryState.replaceNamespace).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ view: 'tabela', fv: '2', group: 'area' }),
        { replace: true },
      )
    })
  })

  it('hidrata URL ausente com a key da view e o padrão salvo', async () => {
    queryState.values = { keep: 'yes' }
    render(<Probe onPersist={() => undefined} />)

    expect(screen.getByTestId('active').textContent).toBe(VIEW_B)
    await waitFor(() => {
      expect(queryState.replaceNamespace).toHaveBeenCalledWith(
        expect.any(Function),
        { view: 'outra', fv: '2' },
        { replace: true },
      )
    })
  })

  it('Sim persiste o documento v2 após debounce e aplica retorno autoritativo', async () => {
    vi.useFakeTimers()
    const confirmed = document([STATUS], '2026-09-01T11:00:00.000Z')
    const onPersist = vi.fn(async () => confirmed)
    queryState.values = { view: 'tabela', fv: 2, group: 'status' }
    render(<Probe onPersist={onPersist} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    expect(screen.getByTestId('status').textContent).toBe('saving')
    expect(onPersist).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
      await vi.runAllTimersAsync()
    })
    expect(onPersist).toHaveBeenCalledWith(
      VIEW_A,
      expect.objectContaining({ version: 2, groupBy: [STATUS] }),
    )
    expect(screen.getByTestId('status').textContent).toBe('confirmed')
    expect(screen.getByTestId('updated').textContent).toBe(confirmed.updatedAt)
  })

  it('mudança remota cria pending sem alterar análise e Atualizar não escreve', async () => {
    const onPersist = vi.fn()
    const initial = makeSettings(document([AREA]))
    queryState.values = { view: 'tabela', fv: 2, group: 'area' }
    const { rerender } = render(<Probe settings={initial} onPersist={onPersist} />)

    const remote = makeSettings(document([STATUS], '2026-09-01T12:00:00.000Z'))
    rerender(<Probe settings={remote} onPersist={onPersist} />)

    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('remote-pending'),
    )
    expect(screen.getByTestId('groups').textContent).toBe(AREA)

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(screen.getByTestId('groups').textContent).toBe(STATUS)
    expect(screen.getByTestId('status').textContent).toBe('confirmed')
    expect(onPersist).not.toHaveBeenCalled()
  })

  it('Atualizar cancela o write local que ainda estava no debounce', async () => {
    vi.useFakeTimers()
    const onPersist = vi.fn()
    queryState.values = { view: 'outra', fv: 2 }
    const { rerender } = render(<Probe onPersist={onPersist} />)

    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
    rerender(
      <Probe
        settings={makeSettings(
          document([AREA]),
          document([STATUS], '2026-09-01T12:15:00.000Z'),
        )}
        onPersist={onPersist}
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('status').textContent).toBe('remote-pending')

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })

    expect(screen.getByTestId('groups').textContent).toBe(STATUS)
    expect(onPersist).not.toHaveBeenCalled()
  })

  it('poda referência removida do estado efetivo, URL e persistência uma vez', async () => {
    vi.useFakeTimers()
    const filters: ViewFiltersV2 = {
      version: 2,
      updatedAt: '2026-09-01T10:00:00.000Z',
      groupBy: [STATUS],
      clauses: [{ columnId: STATUS, condition: 'equals', values: [ACTIVE] }],
      passthrough: [],
    }
    const onPersist = vi.fn(async (_viewId: string, value: ViewFiltersV2) => value)
    queryState.values = { view: 'tabela' }
    const { rerender } = render(
      <Probe settings={makeSettings(filters)} onPersist={onPersist} />,
    )
    const withoutStatus = COLUMNS.filter((column) => column.id !== STATUS)

    rerender(
      <Probe
        settings={makeSettings(filters)}
        columns={withoutStatus}
        onPersist={onPersist}
      />,
    )

    expect(screen.getByTestId('groups').textContent).toBe('')
    expect(screen.getByTestId('clauses').textContent).toBe('[]')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
      await vi.runAllTimersAsync()
    })
    expect(onPersist).toHaveBeenCalledTimes(1)
    expect(onPersist).toHaveBeenCalledWith(
      VIEW_A,
      expect.objectContaining({ clauses: [], groupBy: [] }),
    )
  })

  it('eco semanticamente igual confirma a edição local pelo timestamp', async () => {
    vi.useFakeTimers()
    const onPersist = vi.fn(async (_viewId: string, filters: ViewFiltersV2) => filters)
    queryState.values = { view: 'outra', fv: 2 }
    const { rerender } = render(<Probe onPersist={onPersist} />)

    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
    expect(screen.getByTestId('status').textContent).toBe('saving')
    const echo = makeSettings(
      document([AREA]),
      document([EMAIL], '2026-09-01T12:30:00.000Z'),
    )
    rerender(<Probe settings={echo} onPersist={onPersist} />)

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('status').textContent).toBe('confirmed')
    expect(screen.getByTestId('groups').textContent).toBe(EMAIL)
    expect(screen.getByTestId('updated').textContent).toBe('2026-09-01T12:30:00.000Z')
  })

  it('descarta snapshot remoto velho, mas aceita empate de timestamp na ordem de emissão', async () => {
    const onPersist = vi.fn()
    queryState.values = { view: 'tabela', fv: 2, group: 'area' }
    const baseline = makeSettings(document([AREA], '2026-09-01T12:00:00.000Z'))
    const { rerender } = render(<Probe settings={baseline} onPersist={onPersist} />)

    rerender(
      <Probe
        settings={makeSettings(document([STATUS], '2026-09-01T11:59:59.999Z'))}
        onPersist={onPersist}
      />,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByTestId('status').textContent).toBe('confirmed')

    rerender(
      <Probe
        settings={makeSettings(document([STATUS], '2026-09-01T12:00:00.000Z'))}
        onPersist={onPersist}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId('status').textContent).toBe('remote-pending'),
    )
  })

  it('falha da revisão atual reverte, corrige URL e permite retry', async () => {
    vi.useFakeTimers()
    const onPersist = vi
      .fn<(viewId: string, filters: ViewFiltersV2) => Promise<ViewFiltersV2>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementation(async (_viewId, filters) => ({
        ...filters,
        updatedAt: '2026-09-01T13:00:00.000Z',
      }))
    queryState.values = { view: 'outra', fv: 2 }
    render(<Probe onPersist={onPersist} />)

    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
    expect(screen.getByTestId('groups').textContent).toBe(EMAIL)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
      await vi.runAllTimersAsync()
    })

    expect(screen.getByTestId('status').textContent).toBe('error')
    expect(screen.getByTestId('groups').textContent).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(screen.getByTestId('groups').textContent).toBe(EMAIL)
    expect(screen.getByTestId('status').textContent).toBe('saving')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
      await vi.runAllTimersAsync()
    })
    expect(screen.getByTestId('status').textContent).toBe('confirmed')
    expect(onPersist).toHaveBeenCalledTimes(2)
  })

  it('flush no unmount não deixa a última edição pendente', async () => {
    vi.useFakeTimers()
    const onPersist = vi.fn(async (_viewId: string, filters: ViewFiltersV2) => filters)
    queryState.values = { view: 'outra', fv: 2 }
    const { unmount } = render(<Probe onPersist={onPersist} />)
    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))

    unmount()
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it('troca de página força o flush da última versão do scope anterior', async () => {
    vi.useFakeTimers()
    const onPersist = vi.fn(async (_viewId: string, filters: ViewFiltersV2) => filters)
    queryState.values = { view: 'outra', fv: 2 }
    const { rerender } = render(<Probe scopeKey="page-1" onPersist={onPersist} />)
    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))

    rerender(<Probe scopeKey="page-2" onPersist={onPersist} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(onPersist).toHaveBeenCalledTimes(1)
    expect(onPersist).toHaveBeenCalledWith(
      VIEW_B,
      expect.objectContaining({ groupBy: [EMAIL] }),
    )
  })

  it('resposta antiga após troca de view não reescreve a URL ativa', async () => {
    vi.useFakeTimers()
    let resolvePersist!: (filters: ViewFiltersV2) => void
    const onPersist = vi.fn(
      () =>
        new Promise<ViewFiltersV2>((resolve) => {
          resolvePersist = resolve
        }),
    )
    queryState.values = { view: 'outra', fv: 2 }
    const { rerender } = render(<Probe onPersist={onPersist} />)

    fireEvent.click(screen.getByRole('button', { name: 'Alterar' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250)
    })
    expect(onPersist).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'View A' }))
    queryState.values = { view: 'tabela', fv: 2, group: 'area' }
    rerender(<Probe onPersist={onPersist} />)
    await act(async () => {
      await Promise.resolve()
    })
    queryState.replaceNamespace.mockClear()

    await act(async () => {
      resolvePersist(document([EMAIL], '2026-09-01T14:00:00.000Z'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByTestId('active').textContent).toBe(VIEW_A)
    expect(queryState.replaceNamespace).not.toHaveBeenCalled()
  })
})
