import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VirtualInfiniteList } from './VirtualInfiniteList'
import { GraphView } from './GraphView'
import { CalendarView } from './CalendarView'
import { TableView } from './TableView'
import { CubsDatabase } from '../CubsDatabase'
import type { DatabasePagination, DatabasePageStream } from '../pagination'
import type { HeaderCol, RowData } from '../types'
import { emptyViewFilters } from '../viewFilters'

const rows: RowData[] = Array.from({ length: 100 }, (_, index) => ({ id: `row-${index}`, cells: { page_title: { value: `Página ${index}` } } }))
const title: HeaderCol = { id: 'page_title', key: 'title', title: 'Nome', type: 'text' }
function pagination(kind: 'table' | 'graph' | 'calendar' = 'table'): DatabasePagination {
  const stream: DatabasePageStream = { scope: { type: 'root' }, rows, total: 10000, hasNextPage: true, hasPreviousPage: false, isFetching: false, beforeHeight: 0, afterHeight: 0 }
  return { projection: { version: 1, kind, pageId: 'root', viewId: 'view', queryKey: 'query', orderRevision: 1, total: 10000, windows: [] },
    streams: { root: stream }, loadNext: vi.fn(), loadPrevious: vi.fn(), ensureScope: vi.fn(), setScope: vi.fn(), pinRow: vi.fn(), onInteractionChange: vi.fn(), reportWindow: vi.fn(), loading: false }
}

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return this.hasAttribute('data-infinite-list') ? 320 : 80 })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('paginated renderers', () => {
  it('mounts only a viewport, retains a pinned card, and requests the next page only after scrolling', async () => {
    const bridge = pagination()
    const { container } = render(<VirtualInfiniteList items={rows} itemKey={(row) => row.id} renderItem={(row) => <span>{row.id}</span>}
      pagination={bridge} scope={{ type: 'root' }} stream={bridge.streams.root} pinnedIds={['row-90']} estimateSize={80} />)
    await waitFor(() => expect(screen.getByText('row-0')).toBeTruthy())
    expect(screen.getByText('row-90')).toBeTruthy()
    expect(container.querySelectorAll('[data-list-row]').length).toBeLessThan(20)
    expect(bridge.reportWindow).toHaveBeenLastCalledWith('root', expect.objectContaining({ firstId: 'row-0', lastId: 'row-3', visible: true }))
    expect(bridge.loadNext).not.toHaveBeenCalled()
    fireEvent.scroll(container.querySelector('[data-infinite-list]')!, { target: { scrollTop: 7700 } })
    await waitFor(() => expect(bridge.loadNext).toHaveBeenCalledWith({ type: 'root' }))
  })

  it('pins the focused editor and defers reconciliation until focus leaves', async () => {
    const bridge = pagination()
    render(<VirtualInfiniteList items={rows} itemKey={(row) => row.id} renderItem={(row) => <input aria-label={row.id} />}
      pagination={bridge} scope={{ type: 'root' }} stream={bridge.streams.root} />)
    const editor = await screen.findByRole('textbox', { name: 'row-0' })
    fireEvent.focus(editor)
    expect(bridge.pinRow).toHaveBeenCalledWith('row-0', true)
    expect(bridge.onInteractionChange).toHaveBeenCalledWith(true)
    fireEvent.blur(editor)
    expect(bridge.pinRow).toHaveBeenCalledWith('row-0', false)
    expect(bridge.onInteractionChange).toHaveBeenCalledWith(false)
  })

  it('retains evicted window space and fetches the previous cursor when scrolling back', () => {
    const bridge = pagination()
    bridge.streams.root.beforeHeight = 1000
    bridge.streams.root.afterHeight = 600
    bridge.streams.root.hasPreviousPage = true
    const { container } = render(<VirtualInfiniteList items={rows} itemKey={(row) => row.id} renderItem={(row) => <span>{row.id}</span>}
      pagination={bridge} scope={{ type: 'root' }} stream={bridge.streams.root} estimateSize={80} />)
    const viewport = container.querySelector('[data-infinite-list]')!
    expect((viewport.firstElementChild as HTMLElement).style.height).toBe('9600px')
    fireEvent.wheel(viewport, { deltaY: -100 })
    expect(bridge.loadPrevious).toHaveBeenCalledWith({ type: 'root' })
    expect(bridge.loadNext).not.toHaveBeenCalled()
  })

  it('keeps selected IDs when a paginated row leaves the retained cache', async () => {
    const bridge = pagination()
    const selection = vi.fn()
    const { rerender } = render(<TableView columns={[title]} rows={rows.slice(0, 2)} pagination={bridge} onSelectionChange={selection} />)
    fireEvent.click((await screen.findAllByRole('checkbox', { name: 'Selecionar linha' }))[0])
    await waitFor(() => expect(selection).toHaveBeenLastCalledWith(['row-0']))
    rerender(<TableView columns={[title]} rows={rows.slice(10, 12)} pagination={bridge} onSelectionChange={selection} />)
    expect(selection).toHaveBeenLastCalledWith(['row-0'])
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Selecionar linha' })[0])
    await waitFor(() => expect(selection).toHaveBeenLastCalledWith(['row-0', 'row-10']))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todas' }))
    await waitFor(() => expect(selection).toHaveBeenLastCalledWith(['row-0', 'row-10', 'row-11']))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todas' }))
    await waitFor(() => expect(selection).toHaveBeenLastCalledWith(['row-0']))
  })

  it('uses server membership and order even when local filters and snapshots disagree', async () => {
    const bridge = pagination()
    const supplied = [rows[9], rows[2]]
    bridge.streams.root.rows = supplied
    const { container } = render(<CubsDatabase rows={supplied} headerCols={[title]} pagination={bridge} settings={{ view: {
      view: 'table', name: 'Tabela', urlKey: { key: 'table', aliases: [] }, orderedHeaderCols: [], orderedRows: ['row-2', 'row-9'],
      filters: { ...emptyViewFilters(), clauses: [{ columnId: 'page_title', condition: 'contains', values: ['inexistente'] }] },
    } }} />)
    await waitFor(() => expect(container.querySelectorAll('[data-list-row]').length).toBe(2))
    expect([...container.querySelectorAll('[data-list-row]')].map((node) => node.getAttribute('data-list-row'))).toEqual(['row-9', 'row-2'])
  })

  it('loads graph branches on demand even when the legacy automatic option is enabled', () => {
    const bridge = pagination('graph')
    bridge.streams.root.rows = rows.slice(0, 2)
    const legacyLoad = vi.fn()
    render(<GraphView rootId="root" rootTitle="Raiz" rows={rows.slice(0, 2)} loadSubItems onLoadChildren={legacyLoad} pagination={bridge} />)
    expect(bridge.ensureScope).not.toHaveBeenCalled()
    expect(legacyLoad).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Página 0' }))
    expect(bridge.ensureScope).toHaveBeenCalledWith({ type: 'graph', parentId: 'row-0' })
    fireEvent.click(screen.getByRole('button', { name: 'Mais 9998 páginas' }))
    expect(bridge.loadNext).toHaveBeenCalledWith({ type: 'root' })
  })
  it('keeps an evicted Graph ancestor reachable and loads continuation when keyboard focused', () => {
    const bridge = pagination('graph')
    bridge.streams = { 'graph:ancestor': { ...bridge.streams.root, scope: { type: 'graph', parentId: 'ancestor' }, rows: [rows[0]], total: 101 } }
    bridge.navigation = { ancestor: { id: 'ancestor', parentId: 'root', title: 'Ancestor' } }
    render(<GraphView rootId="root" rootTitle="Raiz" rows={[]} loadSubItems pagination={bridge} />)
    expect(screen.getByRole('button', { name: 'Ancestor' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Página 0' })).toBeTruthy()
    const more = screen.getByRole('button', { name: 'Mais 100 páginas' })
    fireEvent.focus(more)
    expect(bridge.loadNext).toHaveBeenCalledExactlyOnceWith({ type: 'graph', parentId: 'ancestor' })
    expect(bridge.pinRow).toHaveBeenCalledWith('ancestor', true)
  })
  it('suspends automatic loading after a stream error and offers explicit retry', () => {
    const bridge = pagination()
    bridge.streams.root.error = new Error('failed')
    bridge.retry = vi.fn()
    const { container } = render(<VirtualInfiniteList items={rows} itemKey={(row) => row.id} renderItem={(row) => <span>{row.id}</span>}
      pagination={bridge} scope={{ type: 'root' }} stream={bridge.streams.root} />)
    fireEvent.scroll(container.querySelector('[data-infinite-list]')!, { target: { scrollTop: 7700 } })
    expect(bridge.loadNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Não foi possível carregar. Tentar novamente' }))
    expect(bridge.retry).toHaveBeenCalledExactlyOnceWith({ type: 'root' })
  })

  it('shows authorized calendar totals when capped previews have no event for the day', () => {
    const bridge = pagination('calendar')
    bridge.projection!.initialDate = '2026-10-04'
    bridge.projection!.days = { '2026-10-05': 500 }
    bridge.streams.root.rows = []
    render(<CalendarView rows={[]} columns={[title, { id: 'date', title: 'Data', type: 'date' }]} pagination={bridge} />)
    expect(screen.getByRole('button', { name: '+500 itens' })).toBeTruthy()
    expect(bridge.ensureScope).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '+500 itens' }))
    expect(bridge.ensureScope).toHaveBeenCalledWith(expect.objectContaining({ type: 'calendar', day: '2026-10-05' }))
  })

  it('adopts the server initial month after metadata arrives and preserves subsequent navigation', () => {
    const bridge = pagination('calendar')
    const projection = bridge.projection!
    bridge.projection = null
    bridge.streams.root.rows = []
    const columns: HeaderCol[] = [title, { id: 'date', title: 'Data', type: 'date' }]
    const { rerender } = render(<CalendarView rows={[]} columns={columns} pagination={bridge} />)
    expect(bridge.setScope).not.toHaveBeenCalled()
    bridge.projection = { ...projection, initialDate: '2025-05-06' }
    rerender(<CalendarView rows={[]} columns={columns} pagination={bridge} />)
    expect(screen.getByRole('heading', { name: 'maio' })).toBeTruthy()
    expect(bridge.setScope).toHaveBeenLastCalledWith({ type: 'calendar', from: '2025-04-27', to: '2025-05-31' })
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('heading', { name: 'junho' })).toBeTruthy()
    bridge.projection = { ...projection, initialDate: '2024-01-01' }
    rerender(<CalendarView rows={[]} columns={columns} pagination={bridge} />)
    expect(screen.getByRole('heading', { name: 'junho' })).toBeTruthy()
  })
})
