import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  listMine: vi.fn(),
  listOrganizations: vi.fn(),
  searchUsers: vi.fn(),
  querySet: vi.fn(),
  chooseExplicitly: true,
  tab: 'workspaces',
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ lang: 'pt-br' }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Helder', email: 'helder@ifc.edu.br' } }),
}))

vi.mock('@/hooks/useQueryParams', () => ({
  useQueryParams: () => ({
    getBoolean: () => mocks.chooseExplicitly,
    get: () => mocks.tab,
    set: mocks.querySet,
  }),
}))

vi.mock('@/services/WorkspaceService', () => ({
  workspaceService: {
    listMine: mocks.listMine,
    listOrganizations: mocks.listOrganizations,
    searchOrganizationWorkspaceUsers: mocks.searchUsers,
    addOrganizationWorkspaceUser: vi.fn(),
    createOrganization: vi.fn(),
  },
}))

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: { icon: string; className?: string }) => (
    <span data-icon={icon} {...props} />
  ),
}))

import { WorkspaceSelectorPage } from './WorkspaceSelectorPage'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.chooseExplicitly = true
  mocks.tab = 'workspaces'
  window.localStorage.clear()
  mocks.listOrganizations.mockResolvedValue([
    { id: 'organization-1', name: 'IFC', data: {}, role: 'superadmin', workspaceCount: 2 },
  ])
  mocks.listMine.mockResolvedValue([
    {
      id: 'workspace-admin',
      name: 'Workspace administrada',
      data: {},
      organizationId: 'organization-1',
      organizationName: 'IFC',
      icon: 'lucide:boxes',
      createdByUserId: 'user-1',
      role: 'superadmin',
      pageRootId: 'page-admin',
    },
    {
      id: 'workspace-member',
      name: 'Workspace como member',
      data: {},
      organizationId: 'organization-1',
      organizationName: 'IFC',
      icon: 'lucide:box',
      createdByUserId: 'user-2',
      role: 'member',
      pageRootId: 'page-member',
    },
  ])
})

describe('WorkspaceSelectorPage', () => {
  it('expõe configurações somente para superadmin e mantém Entrar como acesso à workspace', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    window.localStorage.setItem('cubs.preferredWorkspace', JSON.stringify({
      userId: 'user-1',
      workspaceId: 'workspace-admin',
    }))
    const view = render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSelectorPage />
      </QueryClientProvider>,
    )

    const settings = await screen.findByRole('button', { name: 'Configurações' })
    expect(screen.getAllByRole('button', { name: 'Configurações' })).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Entrar' })).toHaveLength(2)

    fireEvent.click(settings)

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({
      to: '/$lang/workspaces/$workspaceId/settings/general',
      params: { lang: 'pt-br', workspaceId: 'workspace-admin' },
      search: expect.any(Function),
    })))
    const navigation = mocks.navigate.mock.calls.at(-1)?.[0]
    expect(navigation.search({ view: 'old-view', tab: 'workspaces' })).toEqual({
      view: undefined,
      tab: undefined,
    })

    // A limpeza de `choose` acontece durante a saída. Ela não pode reativar o
    // redirect automático para a workspace preferida e vencer a navegação.
    mocks.chooseExplicitly = false
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSelectorPage />
      </QueryClientProvider>,
    )
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1))
  })

  it('não deixa o redirect da workspace preferida vencer a saída pelo fluxo da organização', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    mocks.tab = 'organization'
    window.localStorage.setItem('cubs.preferredWorkspace', JSON.stringify({
      userId: 'user-1',
      workspaceId: 'workspace-admin',
    }))
    const view = render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSelectorPage />
      </QueryClientProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Criar workspace' }))
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$lang/workspaces/new',
      params: { lang: 'pt-br' },
      search: { tab: 'create', organization: 'organization-1' },
    })

    mocks.chooseExplicitly = false
    mocks.tab = 'workspaces'
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSelectorPage />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1))
  })
})
