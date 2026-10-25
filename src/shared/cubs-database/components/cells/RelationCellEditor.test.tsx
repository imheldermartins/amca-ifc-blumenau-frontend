import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

import type { HeaderCol, RelationTarget } from '../../types'
import { RelationCellEditor, RelationChips } from './RelationCellEditor'

type OptionsPage = { items: RelationTarget[]; nextCursor: string | null }
const output = { id: 'output', title: '20/10/2026' }
const product = { id: 'product', title: 'Sabonete Dove' }
const column: HeaderCol = {
  id: 'relation', title: 'Saída do Estoque', type: 'relation',
  relation: { version: 1, targetDatabaseId: 'outputs' },
  // The projection shares this title lookup across every relation column.
  relationTargets: { output, product },
}
const props = { rowId: 'row', value: ['output'], onCommit: vi.fn() }

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

afterEach(cleanup)

describe('RelationCellEditor — destination scope', () => {
  it('preserves the selected title through toggles, search and close before projection hydration', async () => {
    const loadRelationOptions = vi.fn().mockResolvedValueOnce({ items: [output], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null })
    function Harness({ targets, disabled }: { targets?: HeaderCol['relationTargets']; disabled?: boolean }) {
      const [value, setValue] = useState<unknown>(null)
      return <RelationCellEditor rowId="row" value={value} onCommit={setValue} disabled={disabled}
        column={{ ...column, relationTargets: targets, loadRelationOptions }} />
    }
    const view = render(<Harness />)
    const trigger = screen.getByRole('button', { name: column.title })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: output.title }))
    expect(trigger.textContent).toBe(output.title)
    fireEvent.click(screen.getByRole('button', { name: output.title }))
    expect(trigger.textContent).toBe('—')
    fireEvent.click(screen.getByRole('button', { name: output.title }))
    expect(trigger.textContent).toBe(output.title)
    view.rerender(<Harness disabled />)
    expect((trigger as HTMLButtonElement).disabled).toBe(true)
    expect(trigger.textContent).toBe(output.title)
    expect(screen.queryByRole('textbox', { name: 'Buscar páginas' })).toBeNull()
    view.rerender(<Harness />)
    expect(trigger.textContent).toBe(output.title)
    fireEvent.click(trigger)
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar páginas' }), { target: { value: 'inexistente' } })
    await screen.findByText('Nenhuma página encontrada')
    expect(trigger.textContent).toBe(output.title)
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Buscar páginas' }), { key: 'Escape' })
    expect(trigger.textContent).toBe(output.title)
    view.rerender(<Harness targets={{ output: { ...output, title: 'Título atualizado' } }} />)
    expect(trigger.textContent).toBe('Título atualizado')
    view.rerender(<Harness targets={{ output: { ...output, title: null } }} />)
    expect(trigger.textContent).toBe('Sem título')
  })

  it('distinguishes an unresolved title from a page with no title', () => {
    const view = render(<RelationChips column={{ ...column, relationTargets: {} }} value={['output']} />)
    expect(screen.getByText('Carregando…')).toBeDefined()
    expect(screen.queryByText('Sem título')).toBeNull()
    view.rerender(<RelationChips column={{ ...column, relationTargets: { output: { ...output, title: null } } }} value={['output']} />)
    expect(screen.getByText('Sem título')).toBeDefined()
  })

  it('keeps a pending response and loaded options when equivalent callbacks change', async () => {
    const initial = deferred<OptionsPage>()
    const loader = vi.fn().mockReturnValueOnce(initial.promise)
    const makeColumn = () => ({ ...column, loadRelationOptions: (input: Parameters<NonNullable<HeaderCol['loadRelationOptions']>>[0]) => loader(input) })
    const view = render(<RelationCellEditor {...props} column={makeColumn()} />)
    fireEvent.click(screen.getByRole('button', { name: column.title }))
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(1))
    view.rerender(<RelationCellEditor {...props} column={makeColumn()} />)
    await act(async () => initial.resolve({ items: [output], nextCursor: null }))
    await screen.findByRole('button', { name: output.title })
    view.rerender(<RelationCellEditor {...props} column={makeColumn()} />)
    expect(screen.getByRole('button', { name: output.title })).toBeDefined()
    await act(async () => { await new Promise((done) => setTimeout(done, 220)) })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('only offers pages returned by the destination query, never the shared title lookup', async () => {
    const loadRelationOptions = vi.fn().mockResolvedValue({ items: [output], nextCursor: null })
    render(<RelationCellEditor {...props} column={{ ...column, loadRelationOptions }} />)
    fireEvent.click(screen.getByRole('button', { name: column.title }))
    expect(screen.queryByRole('button', { name: product.title })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: output.title }))
    expect(loadRelationOptions).toHaveBeenCalledWith({ search: undefined, limit: 50 })
    expect(screen.queryByRole('button', { name: product.title })).toBeNull()
    expect(props.onCommit).toHaveBeenLastCalledWith(null)
  })

  it('does not restore cached or selected titles into an empty search result', async () => {
    const loadRelationOptions = vi.fn().mockResolvedValueOnce({ items: [output], nextCursor: null })
      .mockResolvedValue({ items: [], nextCursor: null })
    render(<RelationCellEditor {...props} column={{ ...column, loadRelationOptions }} />)
    fireEvent.click(screen.getByRole('button', { name: column.title }))
    await screen.findByRole('button', { name: output.title })
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar páginas' }), { target: { value: 'inexistente' } })
    expect(screen.queryByRole('button', { name: output.title })).toBeNull()
    await screen.findByText('Nenhuma página encontrada')
    expect(loadRelationOptions).toHaveBeenLastCalledWith({ search: 'inexistente', limit: 50 })
    expect(screen.queryByRole('button', { name: product.title })).toBeNull()
  })

  it('discards a pagination response from a previous destination', async () => {
    const more = deferred<OptionsPage>()
    const loadOutputs = vi.fn().mockResolvedValueOnce({ items: [output], nextCursor: 'cursor' })
      .mockReturnValueOnce(more.promise)
    const view = render(<RelationCellEditor {...props} column={{ ...column, loadRelationOptions: loadOutputs }} />)
    fireEvent.click(screen.getByRole('button', { name: column.title }))
    fireEvent.click(await screen.findByRole('button', { name: 'Carregar mais' }))
    await waitFor(() => expect(loadOutputs).toHaveBeenCalledTimes(2))
    const loadProducts = vi.fn().mockResolvedValue({ items: [product], nextCursor: null })
    view.rerender(<RelationCellEditor {...props} column={{
      ...column, relation: { version: 1, targetDatabaseId: 'products' }, loadRelationOptions: loadProducts,
    }} />)
    expect(screen.queryByRole('button', { name: output.title })).toBeNull()
    await screen.findByRole('button', { name: product.title })
    await act(async () => more.resolve({ items: [{ id: 'old', title: 'Saída antiga' }], nextCursor: 'old' }))
    expect(screen.queryByRole('button', { name: 'Saída antiga' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).toBeNull()
  })

  it('discards a pending initial response when the search changes', async () => {
    const initial = deferred<OptionsPage>()
    const loadRelationOptions = vi.fn().mockReturnValueOnce(initial.promise)
      .mockResolvedValue({ items: [], nextCursor: null })
    render(<RelationCellEditor {...props} column={{ ...column, loadRelationOptions }} />)
    fireEvent.click(screen.getByRole('button', { name: column.title }))
    await waitFor(() => expect(loadRelationOptions).toHaveBeenCalledTimes(1))
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar páginas' }), { target: { value: 'inexistente' } })
    await screen.findByText('Nenhuma página encontrada')
    await act(async () => initial.resolve({ items: [output], nextCursor: null }))
    expect(screen.queryByRole('button', { name: output.title })).toBeNull()
  })

  it('keeps display titles without offering them as options when no loader is provided', () => {
    render(<RelationCellEditor {...props} column={column} />)
    const trigger = screen.getByRole('button', { name: column.title })
    expect(trigger.textContent).toContain(output.title)
    fireEvent.click(trigger)
    expect(screen.queryByRole('button', { name: product.title })).toBeNull()
    expect(screen.queryByRole('button', { name: output.title })).toBeNull()
  })
})
