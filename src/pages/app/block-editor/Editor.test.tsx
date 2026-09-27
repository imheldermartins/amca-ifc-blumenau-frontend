import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Editor } from './Editor'
import { BLOCK_DRAG_ACTIVATION_CONSTRAINT } from './editorDndConfig'

afterEach(cleanup)

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
})
