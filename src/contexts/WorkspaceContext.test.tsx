import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const doubles = vi.hoisted(() => ({ getWorkspace: vi.fn() }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Pessoa', email: 'pessoa@example.test' } }),
}))
vi.mock('@/services/WorkspaceService', () => ({
  workspaceService: { getWorkspace: doubles.getWorkspace },
}))

import { WorkspaceProvider, useWorkspace } from './WorkspaceContext'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { workspaceQueryKey } from '@/lib/workspaceQueryKeys'
import type { ApiWorkspace } from '@/services/WorkspaceService'

const originalWorkspace: ApiWorkspace = {
  id: 'workspace-1',
  name: 'Nome antigo',
  data: {},
  organizationId: null,
  organizationName: null,
  isPersonal: true,
  icon: 'lucide:boxes',
  createdByUserId: 'user-1',
  owner: { id: 'user-1', name: 'Pessoa', email: 'pessoa@example.test' },
  role: 'role-1',
  pageRootId: 'page-1',
}

function WorkspaceName() {
  const state = useWorkspace()
  if (state.loading) return <span>carregando</span>
  return <span>{state.workspace?.name ?? 'sem workspace'}</span>
}

describe('WorkspaceProvider', () => {
  beforeEach(() => {
    sessionStorage.clear()
    doubles.getWorkspace.mockReset().mockResolvedValue(originalWorkspace)
    currentWorkspaceSession.set('user-1', originalWorkspace.id)
  })

  afterEach(() => cleanup())

  it('reflete no contexto global a workspace atualizada no cache de settings', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceProvider>
          <WorkspaceName />
        </WorkspaceProvider>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Nome antigo')).toBeTruthy())

    act(() => {
      queryClient.setQueryData(
        workspaceQueryKey('user-1', originalWorkspace.id),
        { ...originalWorkspace, name: 'Nome editado', icon: 'lucide:rocket' },
      )
    })

    await waitFor(() => expect(screen.getByText('Nome editado')).toBeTruthy())
    expect(doubles.getWorkspace).toHaveBeenCalledTimes(1)
  })
})
