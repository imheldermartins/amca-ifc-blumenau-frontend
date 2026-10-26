import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core'
import { CellSelection, TableMap } from '@tiptap/pm/tables'
import { Editor } from './Editor'
import { ModalProvider } from '@/contexts/ModalContext'
import { decodePageDocument, encodePageDocument } from '@/shared/page-document-codec'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 100))
  vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
})
const columns = [{ id: 'date', name: 'Data de entrega', type: 'date' }, { id: 'total', name: 'Valor', type: 'numeric' }]
const relations = [{ id: 'relation', name: 'Projetos', columns }]
describe('Recursive editor blocks', () => {
  it('edits a native table, scopes relation mentions and preserves a merged page total', async () => {
    let saved: JSONContent | undefined
    const current = [{ id: 'aggregate', name: 'Valor Total', type: 'numeric' }]
    const view = render(<ModalProvider><Editor recursiveColumns={current} recursiveRelations={relations} onChange={(value) => { saved = value }} /></ModalProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))
    fireEvent.click(screen.getByRole('button', { name: 'Tabela recursiva' }))
    const table = await screen.findByRole('table', { name: 'Tabela recursiva' }) as HTMLTableElement
    const nested = (table.closest('.ProseMirror') as HTMLElement & { editor: TiptapEditor }).editor
    expect(screen.queryByRole('button', { name: 'Configurar' })).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Propriedade Relation' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Projetos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar coluna' }))
    const position = (row: number, col: number) => { const map = TableMap.get(nested.state.doc.firstChild!); return 1 + map.map[row * map.width + col]! }
    await act(async () => { nested.commands.setTextSelection(position(1, 1) + 2); fireEvent.focus(nested.view.dom); nested.commands.insertContent('@') })
    fireEvent.click(await screen.findByRole('option', { name: 'Valor' }))
    await waitFor(() => expect(table.rows[1].cells[1].textContent).toContain('Valor'))
    fireEvent.click(screen.getByRole('button', { name: 'Linha fixa' }))
    await act(async () => { nested.commands.setTextSelection(position(2, 0) + 2); nested.commands.insertContent('Total: @') })
    expect(screen.queryByRole('option', { name: 'Valor' })).toBeNull()
    fireEvent.click(await screen.findByRole('option', { name: 'Valor Total' }))
    const coordinates = vi.spyOn(nested.view, 'posAtCoords').mockImplementation(({ left }) => ({ pos: position(2, left > 50 ? 1 : 0) + 2, inside: position(2, left > 50 ? 1 : 0) + 1 }))
    fireEvent.mouseDown(table.rows[2].cells[1], { button: 0, clientX: 100, clientY: 100 })
    fireEvent.mouseMove(table.rows[2].cells[0], { buttons: 1, clientX: 0, clientY: 100 })
    fireEvent.mouseUp(document)
    expect(nested.state.selection).toBeInstanceOf(CellSelection)
    coordinates.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'Mesclar células' }))
    fireEvent.click(screen.getByRole('button', { name: 'Alinhar à direita' }))
    fireEvent.click(screen.getByRole('button', { name: 'Centralizar verticalmente' }))
    await waitFor(() => expect(JSON.stringify(saved)).toContain('pdf:page:columns.aggregate'))
    expect(JSON.stringify(saved)).toContain('recursive:relation:relation:columns.total')
    expect(table.rows[2].cells[0].getAttribute('colspan')).toBe('2')
    expect(table.rows[2].cells[0].style.textAlign).toBe('right')
    const content = decodePageDocument(encodePageDocument(saved!))
    view.unmount()
    render(<ModalProvider><Editor content={content} recursiveColumns={current} recursiveRelations={relations} /></ModalProvider>)
    const restored = await screen.findByRole('table', { name: 'Tabela recursiva' }) as HTMLTableElement
    expect(restored.rows[2].cells[0].textContent).toContain('Total: Valor Total')
    expect(restored.rows[2].cells[0].getAttribute('colspan')).toBe('2')
    expect(restored.rows[2].cells[0].style.textAlign).toBe('right')
    expect(restored.rows[2].cells[0].style.verticalAlign).toBe('middle')
  })
  it('requires a Relation and takes the date property from its destination without requiring children', async () => {
    const view = render(<ModalProvider><Editor recursiveColumns={columns} /></ModalProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo item' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))
    fireEvent.click(screen.getByRole('button', { name: 'Calendário recursivo' }))
    expect((await screen.findByRole('button', { name: 'Configurar' }) as HTMLButtonElement).disabled).toBe(true)
    view.rerender(<ModalProvider><Editor recursiveRelations={relations} /></ModalProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Configurar' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Propriedade Relation' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Projetos' }))
    fireEvent.click(await screen.findByRole('combobox', { name: 'Propriedade de data' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Data de entrega' }))
    await waitFor(() => expect((screen.getByRole('button', { name: 'Prévia de exemplo' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Prévia de exemplo' }))
    expect(await screen.findByText('março de 2026')).toBeTruthy()
    expect(screen.getByText('agosto de 2028')).toBeTruthy()
    expect(screen.queryByText('Página de exemplo 3')).toBeNull()
    await act(async () => {})
  })
})
