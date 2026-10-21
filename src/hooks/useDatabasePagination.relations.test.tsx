import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { CubsDatabase, emptyViewFilters, type HeaderCol, type RowData } from 'cubs-database'
import { useDatabasePagination } from './useDatabasePagination'
import type { PageViewQueryProjection } from '@/shared/cubs-database/pageViewQueryContract'

const service = vi.hoisted(() => ({ queryView: vi.fn(), listRelationOptions: vi.fn() }))
vi.mock('@/services/DatabaseService', () => ({ databaseService: service }))
vi.mock('@/hooks/useSocket', () => ({ useSocket: () => ({ socket: null }) }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('keeps the selected title across parent renders and editor remounts without F5 or repeated option requests', async () => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-infinite-list') ? 320 : 80
  })
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320)
  const target = { id: 'target', title: 'Página de destino' }
  const projection: PageViewQueryProjection = {
    version: 1, kind: 'table', pageId: 'page', viewId: 'view', queryKey: 'query', orderRevision: 1, total: 1,
    windows: [{
      key: 'root', scope: { type: 'root' }, total: 1, nextCursor: null, previousCursor: null,
      rows: [{ page_id: 'row', page_title: 'Linha', page_columns: {} }],
    }],
  }
  service.queryView.mockResolvedValue(projection)
  service.listRelationOptions.mockResolvedValue({ items: [target], nextCursor: null })
  const columns: HeaderCol[] = [
    { id: 'page_title', key: 'title', title: 'Nome', type: 'text' },
    { id: 'relation', title: 'Relação', type: 'relation', relation: { version: 1, targetDatabaseId: 'destination' } },
  ]
  const filters = emptyViewFilters()
  const view = { view: 'table' as const, name: 'Tabela', filters, urlKey: { key: 'tabela', aliases: [] }, orderedHeaderCols: ['page_title', 'relation'] }
  function Harness() {
    const [rows, setRows] = useState<RowData[]>([])
    const [editable, setEditable] = useState(true)
    const paged = useDatabasePagination({ pageId: 'page', viewId: 'view', view, columns, filters, enabled: true, onRows: setRows })
    return <>
      <button onClick={() => setEditable((previous) => !previous)}>Alternar edição</button>
      <CubsDatabase pageId="page" settings={{ view }} activeViewId="view" rows={rows} headerCols={columns}
        pagination={paged.pagination} onLoadRelationOptions={paged.loadRelationOptions}
        onCellChange={editable ? (change) => paged.bridge.onLocalMutation([change]).commit() : undefined} />
    </>
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Relação' }))
  fireEvent.click(await screen.findByRole('button', { name: target.title }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Relação' }).textContent).toBe(target.title))
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Buscar páginas' }), { key: 'Escape' })
  fireEvent.click(screen.getByRole('button', { name: 'Alternar edição' }))
  expect(screen.queryByRole('button', { name: 'Relação' })).toBeNull()
  expect(screen.getByText(target.title)).toBeDefined()
  fireEvent.click(screen.getByRole('button', { name: 'Alternar edição' }))
  expect(screen.getByRole('button', { name: 'Relação' }).textContent).toBe(target.title)
  await act(async () => { await new Promise((done) => setTimeout(done, 230)) })
  expect(service.listRelationOptions).toHaveBeenCalledTimes(1)
  expect(service.queryView).toHaveBeenCalledTimes(1)
})
