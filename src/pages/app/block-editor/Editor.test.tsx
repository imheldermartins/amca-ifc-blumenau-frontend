import { cleanup, fireEvent, render as testingRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Editor } from './Editor'
import { BLOCK_DRAG_ACTIVATION_CONSTRAINT } from './editorDndConfig'
import { ModalProvider } from '@/contexts/ModalContext'

const render = (ui: ReactElement) => testingRender(ui, { wrapper: ModalProvider })

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('block editor interactions', () => {
  it('returns focus and the empty-line hint after inserting from the block library', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 100))
    vi.spyOn(window, 'scrollBy').mockImplementation(() => {})
    const { container } = render(<Editor />)
    fireEvent.click(await screen.findByRole('button', { name: 'Novo item' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mais' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Texto rico' }))
    await waitFor(() => {
      expect(document.activeElement).toBe(container.querySelector('.ProseMirror'))
      expect(container.querySelectorAll('p[data-placeholder]')).toHaveLength(1)
    })
  })
  it('uses the PageShell width and opens the block menu with a simple click', async () => {
    const { container } = render(<Editor />)
    const dragHandle = await screen.findByRole('button', { name: 'Arrastar bloco' })
    const editorShell = container.querySelector('.cubs-editor')

    expect(editorShell?.className).toContain('w-full')
    expect(editorShell?.className).not.toContain('px-5')
    expect(container.querySelector('p[data-placeholder]')).not.toBeNull()
    fireEvent.focus(container.querySelector('.ProseMirror')!)
    expect(
      container.querySelector('p[data-placeholder]')?.getAttribute('data-placeholder'),
    ).toBe('Digite ou use @ para mencionar uma página ou membro')
    fireEvent.blur(container.querySelector('.ProseMirror')!)
    expect(container.querySelector('p[data-placeholder]')).not.toBeNull()

    fireEvent.click(dragHandle)

    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Distribuir igualmente/ })).toBeTruthy()
  })

  it('does not show the mention hint for a non-empty rich-text paragraph', async () => {
    const { container } = render(<Editor content={{
      type: 'doc',
      content: [{
        type: 'blockRow', attrs: { id: 'row-1' }, content: [{
          type: 'blockColumn', attrs: { id: 'column-1', span: 100 }, content: [{
            type: 'editableBlock', attrs: { id: 'block-1', kind: 'richText', indent: 0 },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Conteúdo' }] }],
          }],
        }],
      }],
    }} />)

    await waitFor(() => {
      expect(container.querySelector('p')?.textContent).toBe('Conteúdo')
      expect(container.querySelector('p[data-placeholder]')).toBeNull()
    })
  })

  it('requires a short hold before starting block drag-and-drop', () => {
    expect(BLOCK_DRAG_ACTIVATION_CONSTRAINT).toEqual({
      delay: 350,
      tolerance: 6,
    })
  })

  it('keeps the original block in its layout without a card placeholder and cancels without changes', async () => {
    const onChange = vi.fn()
    const { container } = render(<Editor onChange={onChange} />)
    const handle = await screen.findByRole('button', { name: 'Arrastar bloco' })
    const block = handle.closest<HTMLElement>('[data-editor-block]')!
    vi.spyOn(block, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 320, 60))
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: 10, clientY: 10,
    })
    Object.defineProperties(pointerDown, { isPrimary: { value: true }, pointerId: { value: 1 } })
    fireEvent(handle, pointerDown)
    await waitFor(() => expect(container.querySelector('.cubs-editor-drag-preview')).not.toBeNull())
    expect(block.classList.contains('is-dragging')).toBe(true)
    expect(block.querySelector('[data-drag-placeholder]')).toBeNull()
    expect(block.querySelector('.cubs-editor-block-content')).not.toBeNull()
    expect(block.style.width).toBe('')
    expect(block.style.height).toBe('')
    expect(block.style.transform).toBe('')
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(container.querySelector('.cubs-editor-drag-preview')).toBeNull())
    expect(block.querySelector('[data-drag-placeholder]')).toBeNull()
    expect(block.style.width).toBe('')
    expect(block.style.height).toBe('')
    expect(onChange).not.toHaveBeenCalled()
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 60))
  })

  it('highlights the destination without resizing it and commits the block there', async () => {
    const onChange = vi.fn()
    const { container } = render(<Editor onChange={onChange} content={{
      type: 'doc',
      content: ['a', 'b'].map((id) => ({
        type: 'blockRow', attrs: { id: `row-${id}` }, content: [{
          type: 'blockColumn', attrs: { id: `col-${id}`, span: 100 }, content: [{
            type: 'editableBlock', attrs: { id, kind: 'richText', indent: 0 },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: id }] }],
          }],
        }],
      })),
    }} />)
    const handles = await screen.findAllByRole('button', { name: 'Arrastar bloco' })
    const originalRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const row = this.closest('[data-row-id]')
      const top = row?.getAttribute('data-row-id') === 'row-b' ? 120 : 0
      if (this.matches('.cubs-editor-row-drop-indicator.is-before')) return new DOMRect(0, top - 5, 320, 10)
      if (this.matches('.cubs-editor-row-drop-indicator.is-after')) return new DOMRect(0, top + 55, 320, 10)
      if (this.matches('.cubs-editor-item-drop-indicator.is-before')) return new DOMRect(0, top, 320, 25)
      if (this.matches('.cubs-editor-item-drop-indicator.is-after')) return new DOMRect(0, top + 35, 320, 25)
      if (this.matches('.cubs-editor-column-drop-indicator.is-left')) return new DOMRect(0, top, 76, 60)
      if (this.matches('.cubs-editor-column-drop-indicator.is-right')) return new DOMRect(244, top, 76, 60)
      if (this.matches('[data-editor-block]')) return new DOMRect(0, top, 320, 60)
      return originalRect.call(this)
    })
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: 10, clientY: 10,
    })
    Object.defineProperties(pointerDown, { isPrimary: { value: true }, pointerId: { value: 1 } })
    fireEvent(handles[0], pointerDown)
    await waitFor(() => expect(container.querySelector('.cubs-editor-drag-preview')).not.toBeNull())
    fireEvent(document, new MouseEvent('pointermove', {
      bubbles: true, cancelable: true, buttons: 1, clientX: 160, clientY: 178,
    }))
    await waitFor(() => expect(container.querySelector('[data-editor-drop-active]')).not.toBeNull())
    const target = container.querySelector<HTMLElement>('[data-editor-drop-active]')!
    expect(target.style.width).toBe('')
    expect(target.style.height).toBe('')
    fireEvent(document, new MouseEvent('pointerup', {
      bubbles: true, cancelable: true, button: 0, clientX: 160, clientY: 178,
    }))
    await waitFor(() => expect(Array.from(container.querySelectorAll('[data-block-id]'), (node) => node.getAttribute('data-block-id'))).toEqual(['b', 'a']))
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(container.querySelector('[data-drag-placeholder]')).toBeNull()
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
})
