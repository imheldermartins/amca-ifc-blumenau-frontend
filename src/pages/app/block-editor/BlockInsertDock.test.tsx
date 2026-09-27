import { Editor } from '@tiptap/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BlockInsertDock } from './BlockInsertDock'
import { createEditorExtensions } from './editorExtensions'

let editor: Editor | null = null

afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  vi.useRealTimers()
})

function createEditor() {
  editor = new Editor({
    extensions: createEditorExtensions(),
    content: {
      type: 'doc',
      content: [{
        type: 'blockRow',
        attrs: { id: 'row-1' },
        content: [{
          type: 'blockColumn',
          attrs: { id: 'column-1', span: 100 },
          content: [{
            type: 'editableBlock',
            attrs: { id: 'block-1', kind: 'richText', indent: 0 },
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: 'Bloco atual' }],
            }],
          }],
        }],
      }],
    },
  })
  editor.commands.focus('end')
  return editor
}

describe('BlockInsertDock', () => {
  it('insere texto no clique antes que o hover de dois segundos abra a dock', () => {
    vi.useFakeTimers()
    const currentEditor = createEditor()
    render(<BlockInsertDock editor={currentEditor} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco de texto' })
    const control = addButton.closest('[data-block-insert-control]')
    expect(control).not.toBeNull()

    fireEvent.pointerEnter(control!)
    act(() => vi.advanceTimersByTime(1_000))
    fireEvent.click(addButton)
    act(() => vi.advanceTimersByTime(2_000))

    expect(screen.queryByRole('toolbar', { name: 'Tipos de bloco' })).toBeNull()
    const column = currentEditor.state.doc.firstChild?.firstChild
    expect(column?.childCount).toBe(2)
    expect(column?.child(1).attrs.kind).toBe('richText')
  })

  it('abre a dock somente após dois segundos e expõe o catálogo principal', () => {
    vi.useFakeTimers()
    render(<BlockInsertDock editor={createEditor()} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco de texto' })
    const control = addButton.closest('[data-block-insert-control]')

    fireEvent.pointerEnter(control!)
    act(() => vi.advanceTimersByTime(1_999))
    expect(screen.queryByRole('toolbar', { name: 'Tipos de bloco' })).toBeNull()

    act(() => vi.advanceTimersByTime(1))
    expect(screen.getByRole('toolbar', { name: 'Tipos de bloco' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Imagem' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lista numerada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ver mais blocos' })).toBeTruthy()
  })

  it('abre a biblioteca completa com compressão máxima fixa', () => {
    vi.useFakeTimers()
    render(<BlockInsertDock editor={createEditor()} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco de texto' })
    fireEvent.pointerEnter(addButton.closest('[data-block-insert-control]')!)
    act(() => vi.advanceTimersByTime(2_000))

    fireEvent.click(screen.getByRole('button', { name: 'Ver mais blocos' }))

    expect(screen.getByRole('dialog', { name: 'Todos os blocos' })).toBeTruthy()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.getByText('Compressão máxima')).toBeTruthy()
    expect(screen.getByText('Data URL base64 no bloco')).toBeTruthy()
  })
})
