import { Editor as TiptapEditor } from '@tiptap/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModalProvider } from '@/contexts/ModalContext'
import { Editor } from './Editor'
import { EditorMathPopup } from './EditorMathPopup'
import { createEditorExtensions } from './editorExtensions'

const document = (block = false) => ({ type: 'doc', content: [{ type: 'blockRow', attrs: { id: 'row' }, content: [{
  type: 'blockColumn', attrs: { id: 'column', span: 100 }, content: [{
    type: 'editableBlock', attrs: { id: 'block', kind: block ? 'mathBlock' : 'richText', indent: 0 },
    content: block ? [{ type: 'blockMath', attrs: { latex: 'x^2' } }] : [{ type: 'paragraph', content: [
      { type: 'text', text: 'Antes ' }, { type: 'inlineMath', attrs: { latex: 'x^2' } }, { type: 'text', text: ' depois' },
    ] }],
  }],
}] }] })

afterEach(cleanup)

describe('math editing popup', () => {
  it.each([false, true])('edits math with fixed delimiters and removes the expression (block=%s)', async (block) => {
    const onChange = vi.fn()
    const { container } = render(<ModalProvider><Editor content={document(block)} onChange={onChange} /></ModalProvider>)
    const selector = block ? '[data-type="block-math"]' : '[data-type="inline-math"]'
    await waitFor(() => expect(container.querySelector(selector)).not.toBeNull())
    await act(async () => fireEvent.click(container.querySelector(selector)!))
    await screen.findByRole('dialog', { name: 'Editar expressão matemática' })
    for (const label of ['Delimitador de abertura', 'Delimitador de fechamento']) {
      const delimiter = screen.getByRole('textbox', { name: label }) as HTMLInputElement
      expect(delimiter.readOnly).toBe(true)
      expect(delimiter.value).toBe('$$')
    }
    fireEvent.change(screen.getByRole('textbox', { name: 'Expressão LaTeX' }), { target: { value: 'y^3' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar' })))
    await waitFor(() => expect(container.querySelector(selector)?.getAttribute('data-latex')).toBe('y^3'))
    expect(screen.queryByRole('dialog', { name: 'Editar expressão matemática' })).toBeNull()
    await act(async () => fireEvent.click(container.querySelector(selector)!))
    await screen.findByRole('button', { name: 'Remover expressão matemática' })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remover expressão matemática' })))
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
      expect(JSON.stringify(onChange.mock.lastCall?.[0])).not.toContain(block ? '"blockMath"' : '"inlineMath"')
    })
    await waitFor(() => expect(container.querySelector(selector)).toBeNull())
    expect(container.querySelector('p')?.textContent).toBe(block ? '' : 'Antes  depois')
    expect(onChange).toHaveBeenCalled()
  })

  it('opens when keyboard selection reaches math and preserves it when dismissed', async () => {
    const editor = new TiptapEditor({ extensions: createEditorExtensions(), content: document() })
    let position = -1
    editor.state.doc.descendants((node, pos) => { if (node.type.name === 'inlineMath') position = pos })
    function Harness() {
      const [current, setCurrent] = useState<number | null>(null)
      return <EditorMathPopup editor={editor} position={current} onPositionChange={setCurrent} />
    }
    const view = render(<Harness />)
    try {
      act(() => { editor.commands.setNodeSelection(position) })
      const input = await screen.findByRole('textbox', { name: 'Expressão LaTeX' })
      fireEvent.keyDown(input, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(editor.state.doc.nodeAt(position)?.type.name).toBe('inlineMath')
    } finally { view.unmount(); editor.destroy() }
  })
})
