import { Editor } from '@tiptap/core'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

import { BlockInsertDock } from './BlockInsertDock'
import { createEditorExtensions } from './editorExtensions'
import { ModalProvider } from '@/contexts/ModalContext'

let editor: Editor | null = null

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 480, 100))
})

afterEach(() => {
  cleanup()
  editor?.destroy()
  editor = null
  vi.useRealTimers()
  vi.restoreAllMocks()
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

const renderDock = (dock: ReactNode) => render(<ModalProvider>{dock}</ModalProvider>)

describe('BlockInsertDock', () => {
  it('abre por clique sem inserir texto nem depender de hover', () => {
    vi.useFakeTimers()
    const currentEditor = createEditor()
    renderDock(<BlockInsertDock editor={currentEditor} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco' })
    const control = addButton.closest('[data-block-insert-control]')
    expect(control).not.toBeNull()

    fireEvent.pointerEnter(control!)
    act(() => vi.advanceTimersByTime(3_000))
    expect(screen.queryByRole('toolbar', { name: 'Tipos de bloco' })).toBeNull()
    fireEvent.click(addButton)
    expect(screen.getByRole('toolbar', { name: 'Tipos de bloco' })).toBeTruthy()
    const column = currentEditor.state.doc.firstChild?.firstChild
    expect(column?.childCount).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Texto rico' }))
    expect(column?.childCount).toBe(1)
    expect(currentEditor.state.doc.firstChild?.firstChild?.childCount).toBe(2)
    expect(screen.queryByRole('toolbar', { name: 'Tipos de bloco' })).toBeNull()
  })

  it('mantém a dock aberta ao sair com o mouse e fecha no segundo clique', () => {
    vi.useFakeTimers()
    renderDock(<BlockInsertDock editor={createEditor()} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco' })
    const control = addButton.closest('[data-block-insert-control]')

    fireEvent.click(addButton)
    fireEvent.pointerLeave(control!)
    expect(screen.getByRole('toolbar', { name: 'Tipos de bloco' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Imagem' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Lista numerada' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mais' })).toBeTruthy()
    fireEvent.click(addButton)
    expect(screen.queryByRole('toolbar', { name: 'Tipos de bloco' })).toBeNull()
  })

  it('abre Mais com seções de tipos e sem detalhes técnicos sobre compressão', () => {
    vi.useFakeTimers()
    renderDock(<BlockInsertDock editor={createEditor()} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco' })
    fireEvent.click(addButton)

    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryByText('Compressão máxima')).toBeNull()
    expect(screen.queryByText('Data URL base64 no bloco')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Texto e listas' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Matemática e código' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Equação em bloco' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Enviar formulário' })).toBeNull()
  })

  it('só oferece e insere o bloco de formulário quando existe uma view form', () => {
    vi.useFakeTimers()
    const currentEditor = createEditor()
    renderDock(<BlockInsertDock editor={currentEditor} forms={[{
      viewId: '01KXVZ00000000000000000001',
      label: 'Enviar inscrição',
      icon: 'lucide:send',
    }]} />)
    const addButton = screen.getByRole('button', { name: 'Adicionar bloco' })
    fireEvent.click(addButton)
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar formulário' }))
    const column = currentEditor.state.doc.firstChild?.firstChild
    expect(column?.child(1).attrs.kind).toBe('formSubmit')
    expect(column?.child(1).attrs.formViewId).toBe('01KXVZ00000000000000000001')
  })
})
