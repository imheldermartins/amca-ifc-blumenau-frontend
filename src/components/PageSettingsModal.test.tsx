import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { UserVisualIdentity } from '@/types/user'
import {
  PageSettingsModal,
  type PageSettingsFragment,
  type PageSettingsModalProps,
} from './PageSettingsModal'

afterEach(() => cleanup())

const currentUser: UserVisualIdentity = {
  id: 'user-current',
  name: 'Pessoa Atual',
  email: 'atual@cubs.test',
  slug: 'PA',
  color: 'purple',
}

const collaborator: UserVisualIdentity = {
  id: 'user-other',
  name: 'Outra Pessoa',
  email: 'outra@cubs.test',
  slug: 'OP',
  color: 'blue',
}

function props(overrides: Partial<PageSettingsModalProps> = {}): PageSettingsModalProps {
  return {
    open: true,
    onOpenChange: vi.fn(),
    fragment: '#collaborators',
    onFragmentChange: vi.fn(),
    pageId: 'page-1',
    pageTitle: 'Planejamento',
    currentUser,
    collaborators: [collaborator],
    loading: false,
    failed: false,
    collaboratorCandidates: [],
    candidateQuery: '',
    onCandidateQueryChange: vi.fn(),
    candidatesLoading: false,
    candidatesFailed: false,
    addingCollaboratorId: null,
    onAddCollaborator: vi.fn(),
    ...overrides,
  }
}

describe('PageSettingsModal', () => {
  it('abre diretamente em #collaborators e separa o usuário atual dos vínculos', () => {
    const onFragmentChange = vi.fn<(fragment: PageSettingsFragment) => void>()
    render(<PageSettingsModal {...props({ onFragmentChange })} />)

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByRole('heading', { name: 'Colaboradores' })).toBeTruthy()
    expect(within(panel).getByText('Pessoa Atual')).toBeTruthy()
    expect(within(panel).getByText('(você)')).toBeTruthy()
    expect(within(panel).getByText('Outra Pessoa')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Geral' }))
    expect(onFragmentChange).toHaveBeenCalledWith('#general')
  })

  it('mostra dados úteis na seção geral', () => {
    render(<PageSettingsModal {...props({ fragment: '#general' })} />)

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Planejamento')).toBeTruthy()
    expect(within(panel).getByText('page-1')).toBeTruthy()
  })

  it('cobre loading, erro e lista vazia dos colaboradores', () => {
    const base = props({ collaborators: [], loading: true })
    const { rerender } = render(<PageSettingsModal {...base} />)
    expect(screen.getByRole('status').textContent).toBe('Carregando...')

    rerender(<PageSettingsModal {...base} loading={false} failed />)
    expect(screen.getByRole('alert').textContent).toBe(
      'Não foi possível carregar os colaboradores.',
    )

    rerender(<PageSettingsModal {...base} loading={false} failed={false} />)
    expect(screen.getByText('Esta página não possui outros colaboradores.')).toBeTruthy()
  })

  it('busca e adiciona somente os candidatos recebidos da workspace', () => {
    const onCandidateQueryChange = vi.fn()
    const onAddCollaborator = vi.fn()
    render(<PageSettingsModal {...props({
      collaboratorCandidates: [collaborator],
      onCandidateQueryChange,
      onAddCollaborator,
    })} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar usuários da workspace atual' }), {
      target: { value: 'outra' },
    })
    expect(onCandidateQueryChange).toHaveBeenCalledWith('outra')
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    expect(onAddCollaborator).toHaveBeenCalledWith(collaborator.id)
  })
})
