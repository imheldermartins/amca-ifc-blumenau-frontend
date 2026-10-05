import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Editor } from './Editor'
import { BLOCK_DRAG_ACTIVATION_CONSTRAINT } from './editorDndConfig'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('block editor interactions', () => {
  it('uses the PageShell width and opens the block menu with a simple click', async () => {
    const { container } = render(<Editor />)
    const dragHandle = await screen.findByRole('button', { name: 'Arrastar bloco' })
    const editorShell = container.querySelector('.cubs-editor')

    expect(editorShell?.className).toContain('w-full')
    expect(editorShell?.className).not.toContain('px-5')
    expect(
      container.querySelector('p[data-placeholder]')?.getAttribute('data-placeholder'),
    ).toBe('Digite ou use @ para mencionar uma página ou membro')

    fireEvent.click(dragHandle)

    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: /Distribuir igualmente/ })).toBeTruthy()
  })

  it('requires a short hold before starting block drag-and-drop', () => {
    expect(BLOCK_DRAG_ACTIVATION_CONSTRAINT).toEqual({
      delay: 350,
      tolerance: 6,
    })
  })

  it('reserves the block dimensions during drag and restores the document on cancel', async () => {
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
    expect(block.querySelector('[data-drag-placeholder]')).not.toBeNull()
    expect(block.style.width).toBe('320px')
    expect(block.style.height).toBe('60px')
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

  it('reserves the destination slot and commits the block at that destination', async () => {
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
      if (this.matches('.cubs-editor-row-drop-zone.is-before')) return new DOMRect(0, top - 5, 320, 10)
      if (this.matches('.cubs-editor-row-drop-zone.is-after')) return new DOMRect(0, top + 55, 320, 10)
      if (this.matches('.cubs-editor-item-drop-zone.is-before')) return new DOMRect(0, top, 320, 25)
      if (this.matches('.cubs-editor-item-drop-zone.is-after')) return new DOMRect(0, top + 35, 320, 25)
      if (this.matches('.cubs-editor-column-drop-zone.is-left')) return new DOMRect(0, top, 76, 60)
      if (this.matches('.cubs-editor-column-drop-zone.is-right')) return new DOMRect(244, top, 76, 60)
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
    await waitFor(() => expect(container.querySelector('.is-over > [data-drag-placeholder]')).not.toBeNull())
    const target = container.querySelector<HTMLElement>('.is-over > [data-drag-placeholder]')!.parentElement!
    expect(target.style.width).toBe('320px')
    expect(target.style.height).toBe('60px')
    fireEvent(document, new MouseEvent('pointerup', {
      bubbles: true, cancelable: true, button: 0, clientX: 160, clientY: 178,
    }))
    await waitFor(() => expect(Array.from(container.querySelectorAll('[data-block-id]'), (node) => node.getAttribute('data-block-id'))).toEqual(['b', 'a']))
    expect(onChange).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-drag-placeholder]')).toBeNull()
    cleanup()
    await new Promise((resolve) => setTimeout(resolve, 60))
  })
})
