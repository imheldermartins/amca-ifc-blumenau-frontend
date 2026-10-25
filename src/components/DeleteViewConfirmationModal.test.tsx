import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DeleteViewConfirmationContent } from './DeleteViewConfirmationModal'

afterEach(() => cleanup())

describe('DeleteViewConfirmationContent', () => {
  it('identifica a visualização e só exclui após confirmação explícita', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <DeleteViewConfirmationContent
        viewName="Planejamento anual"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    )

    expect(screen.getByText('Deseja realmente excluir a visualização “Planejamento anual”?')).not.toBeNull()
    const cancel = screen.getByRole('button', { name: 'Cancelar' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.click(cancel)
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir visualização' }))
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledOnce()
      expect(onClose).toHaveBeenCalledTimes(2)
    })
  })
})
