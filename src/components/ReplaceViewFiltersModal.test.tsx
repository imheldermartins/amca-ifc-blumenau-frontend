import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReplaceViewFiltersModal } from './ReplaceViewFiltersModal'

afterEach(() => cleanup())

describe('ReplaceViewFiltersModal', () => {
  it('destaca Não em roxo/autofocus e separa persistir de manter salvo', () => {
    const onReplace = vi.fn()
    const onKeepSaved = vi.fn()
    render(
      <ReplaceViewFiltersModal
        open
        onReplace={onReplace}
        onKeepSaved={onKeepSaved}
      />,
    )

    const no = screen.getByRole('button', { name: 'Não' })
    expect(no.className).toContain('bg-p-purple-500')
    expect(document.activeElement).toBe(no)
    fireEvent.click(no)
    expect(onKeepSaved).toHaveBeenCalledOnce()
    expect(onReplace).not.toHaveBeenCalled()
  })

  it('trata Escape como Não e Sim como substituição persistida', () => {
    const onReplace = vi.fn()
    const onKeepSaved = vi.fn()
    const { rerender } = render(
      <ReplaceViewFiltersModal open onReplace={onReplace} onKeepSaved={onKeepSaved} />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onKeepSaved).toHaveBeenCalledOnce()

    rerender(
      <ReplaceViewFiltersModal open onReplace={onReplace} onKeepSaved={onKeepSaved} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))
    expect(onReplace).toHaveBeenCalledOnce()
  })
})
