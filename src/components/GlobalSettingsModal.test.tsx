import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { WorkspaceState } from '@/contexts/WorkspaceContext'
import { GlobalSettingsModal, type GlobalSettingsFragment } from './GlobalSettingsModal'
import { SignOutConfirmationModal } from './SignOutConfirmationModal'

afterEach(() => cleanup())

const workspaceState: WorkspaceState = {
  workspaceId: '01KXDN4B182DJGAKPX0940H54N',
  workspace: {
    id: '01KXDN4B182DJGAKPX0940H54N',
    name: 'IFC Blumenau',
    data: { example: true },
  },
  loading: false,
  failed: false,
}

function SettingsModalProbe({ initialFragment }: { initialFragment: GlobalSettingsFragment }) {
  const [fragment, setFragment] = useState(initialFragment)

  return (
    <GlobalSettingsModal
      open
      onOpenChange={() => {}}
      fragment={fragment}
      onFragmentChange={setFragment}
      workspaceState={workspaceState}
    />
  )
}

describe('GlobalSettingsModal', () => {
  it('abre no fragmento recebido e troca a tab de forma controlada', () => {
    render(<SettingsModalProbe initialFragment="#workspace" />)

    const workspacePanel = screen.getByRole('tabpanel')
    expect(within(workspacePanel).getByRole('heading', { name: 'Workspace' })).toBeTruthy()
    expect(workspacePanel.textContent).toContain('IFC Blumenau')

    fireEvent.click(screen.getByRole('tab', { name: 'Perfil do usuário' }))

    const profilePanel = screen.getByRole('tabpanel')
    expect(within(profilePanel).getByRole('heading', { name: 'Perfil do usuário' })).toBeTruthy()
    expect(profilePanel.textContent).not.toContain('IFC Blumenau')
  })
})

describe('SignOutConfirmationModal', () => {
  it('mantém Não à direita como ação padrão e cancela sem executar o logout', () => {
    const onOpenChange = vi.fn()
    const onConfirm = vi.fn()
    render(
      <SignOutConfirmationModal open onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    )

    const yes = screen.getByRole('button', { name: 'Sim' })
    const no = screen.getByRole('button', { name: 'Não' })

    expect(yes.nextElementSibling).toBe(no)
    expect(document.activeElement).toBe(no)
    expect(no.className).toContain('bg-p-red-500')

    fireEvent.click(no)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('executa o logout somente após a confirmação positiva', () => {
    const onConfirm = vi.fn()
    render(<SignOutConfirmationModal open onOpenChange={() => {}} onConfirm={onConfirm} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sim' }))

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
