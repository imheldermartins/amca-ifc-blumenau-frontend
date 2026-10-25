import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GlobalSettingsContent, type GlobalSettingsFragment } from './GlobalSettingsModal'
import { SignOutConfirmationContent } from './SignOutConfirmationModal'

afterEach(() => cleanup())

function SettingsModalProbe({ initialFragment }: { initialFragment: GlobalSettingsFragment }) {
  return <GlobalSettingsContent initialFragment={initialFragment} />
}

describe('GlobalSettingsContent', () => {
  it('abre no fragmento recebido e troca a tab de forma controlada', () => {
    render(<SettingsModalProbe initialFragment="#settings" />)

    const settingsPanel = screen.getByRole('tabpanel')
    expect(within(settingsPanel).getByRole('heading', { name: 'Configurações' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Perfil do usuário' }))

    const profilePanel = screen.getByRole('tabpanel')
    expect(within(profilePanel).getByRole('heading', { name: 'Perfil do usuário' })).toBeTruthy()
  })
})

describe('SignOutConfirmationModal', () => {
  it('mantém Não à direita como ação padrão e cancela sem executar o logout', () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    render(
      <SignOutConfirmationContent onClose={onClose} onConfirm={onConfirm} />,
    )

    const yes = screen.getByRole('button', { name: 'Sim' })
    const no = screen.getByRole('button', { name: 'Não' })

    expect(yes.nextElementSibling).toBe(no)
    expect(document.activeElement).toBe(no)
    expect(no.className).toContain('bg-p-red-500')

    fireEvent.click(no)
    expect(onClose).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('executa o logout somente após a confirmação positiva', () => {
    const onConfirm = vi.fn()
    render(<SignOutConfirmationContent onClose={() => {}} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
