import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GraphCanvas, GraphView } from './GraphView'
import { CubsDatabase } from '../CubsDatabase'
import { emptyViewFilters } from '../viewFilters'
import type { HeaderCol } from '../types'

afterEach(cleanup)

const columns: HeaderCol[] = [{ id: 'page_title', key: 'title', title: 'Título', type: 'text' }, { id: 'status', title: 'Status', type: 'text' }]
const rows = [{ id: 'child', cells: { page_title: { value: 'Entrega' }, status: { value: 'Em andamento' } } }]

describe('Graph interactions', () => {
  it('always shows only the Grid card and updates it with the selected properties', () => {
    const onEditRow = vi.fn()
    render(<GraphView rootId="root" rootTitle="Base" rows={rows} columns={columns} loadSubItems={false} onEditRow={onEditRow} />)
    expect(within(screen.getByRole('complementary')).getByText('Base')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entrega' }))
    const details = screen.getByRole('complementary', { name: 'Detalhes da página' })
    expect(details.querySelector('article[data-list-row="child"]')).toBeTruthy()
    expect(within(details).getByText('Em andamento')).toBeTruthy()
    expect(onEditRow).not.toHaveBeenCalled()
    fireEvent.click(within(details).getByRole('button', { name: 'Abrir Entrega' }))
    expect(onEditRow).toHaveBeenCalledExactlyOnceWith('child', 'root', 'Base')
    expect(within(details).queryByText('Detalhes da página')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Fechar detalhes' })).toBeNull()
  })

  it('loads nested properties using the immediate parent schema', async () => {
    const onLoadColumns = vi.fn().mockResolvedValue([{ id: 'nested', title: 'Propriedade filha', type: 'text' }])
    const onLoadChildren = vi.fn().mockResolvedValue([{ id: 'grandchild', cells: { page_title: { value: 'Subtarefa' }, nested: { value: 'Valor filho' } } }])
    render(<GraphView rootId="root" rootTitle="Base" rows={rows} columns={columns} loadSubItems={false} onLoadColumns={onLoadColumns} onLoadChildren={onLoadChildren} />)
    fireEvent.click(screen.getByRole('button', { name: 'Entrega' }))
    expect(onLoadColumns).not.toHaveBeenCalled()
    fireEvent.click(await screen.findByRole('button', { name: 'Subtarefa' }))
    await waitFor(() => expect(screen.getByText('Valor filho')).toBeTruthy())
    expect(onLoadColumns).toHaveBeenCalledExactlyOnceWith('child')
    expect(screen.queryByText('Status')).toBeNull()
  })

  it('creates a child on the first plus gesture without focusing or dragging its node', () => {
    const onCreateChild = vi.fn(), onFocus = vi.fn(), onDragChange = vi.fn()
    render(<GraphCanvas points={[{ id: 'child', title: 'Entrega', x: 0, y: 0, vx: 0, vy: 0, radius: 50, depth: 1 }]}
      focusedId="root" loadingIds={new Set()} onFocus={onFocus} onDragChange={onDragChange} onCreateChild={onCreateChild} />)
    const plus = screen.getByRole('button', { name: 'Adicionar filho em Entrega' })
    fireEvent.pointerDown(plus, { pointerId: 1, clientX: 30, clientY: 40 })
    fireEvent.pointerUp(plus, { pointerId: 1, clientX: 30, clientY: 40 })
    fireEvent.click(plus)
    expect(onCreateChild).toHaveBeenCalledOnce()
    expect(onFocus).not.toHaveBeenCalled()
    expect(onDragChange).not.toHaveBeenCalled()
  })

  it('routes root and child plus buttons to their own parent using the shared creation controller', () => {
    const onRequestCreateRow = vi.fn()
    render(<CubsDatabase pageId="root" pageTitle="Base" rows={rows} headerCols={columns}
      settings={{ graph: { view: 'graph', name: 'Grafo', orderedHeaderCols: [], urlKey: { key: 'graph', aliases: [] }, filters: emptyViewFilters() } }}
      onRequestCreateRow={onRequestCreateRow} />)
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar filho em Entrega' }))
    expect(onRequestCreateRow).toHaveBeenCalledExactlyOnceWith({ viewType: 'graph', viewId: 'graph', parentPageId: 'child', destinationLabel: 'Entrega' })
    expect(within(screen.getByRole('complementary')).getByText('Base')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar filho em Base' }))
    expect(onRequestCreateRow).toHaveBeenLastCalledWith({ viewType: 'graph', viewId: 'graph', parentPageId: 'root', destinationLabel: 'Base' })
  })
})
