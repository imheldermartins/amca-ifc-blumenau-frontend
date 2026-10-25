import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ModalProvider } from './ModalContext'
import { useModal } from '@/hooks/useModal'

function Probe({ onClose = () => undefined }: { onClose?: () => void }) {
  const modal = useModal()
  return <button type="button" onClick={() => modal.openModal({
    size: 'sm',
    onClose,
    content: ({ closeModal, setModalContent }) => <>
      <p>Conteúdo inicial</p>
      <button type="button" onClick={() => setModalContent(<>
        <p>Conteúdo substituído</p>
        <button type="button" onClick={closeModal}>Concluir</button>
      </>)}>Trocar conteúdo</button>
      <button type="button" onClick={closeModal}>Concluir</button>
    </>,
  })}>Abrir</button>
}

function NondismissibleProbe() {
  const { openModal } = useModal()
  return <button type="button" onClick={() => openModal({
    dismissible: false,
    content: ({ closeModal }) => <button type="button" onClick={closeModal}>Finalizar internamente</button>,
  })}>Abrir bloqueada</button>
}

describe('ModalProvider', () => {
  it('abre por configuração global, substitui o conteúdo e fecha a instância', () => {
    const onClose = vi.fn()
    render(<ModalProvider><Probe onClose={onClose} /></ModalProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }))
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(screen.getByText('Conteúdo inicial')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Trocar conteúdo' }))
    expect(screen.queryByText('Conteúdo inicial')).toBeNull()
    expect(screen.getByText('Conteúdo substituído')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('impede dispensar externamente quando a configuração bloqueia o fechamento', () => {
    render(<ModalProvider><NondismissibleProbe /></ModalProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Abrir bloqueada' }))
    const dialog = screen.getByRole('dialog')
    expect((screen.getByRole('button', { name: 'Fechar' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.getByRole('dialog')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Finalizar internamente' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
