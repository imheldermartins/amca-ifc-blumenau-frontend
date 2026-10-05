import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  querySet: vi.fn(),
  listMine: vi.fn(),
  listOrganizations: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ lang: 'pt-br' }),
}))

vi.mock('@/hooks/useQueryParams', () => ({
  useQueryParams: () => ({
    get: (key: string) => key === 'organization' ? 'organization-admin' : 'create',
    set: mocks.querySet,
  }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Helder', email: 'helder@ifc.edu.br' } }),
}))

vi.mock('@/services/WorkspaceService', () => ({
  workspaceService: {
    listMine: mocks.listMine,
    listOrganizations: mocks.listOrganizations,
    create: mocks.create,
  },
}))

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: { icon: string; className?: string }) => (
    <span data-icon={icon} {...props} />
  ),
}))

import { WorkspaceAccessPage } from './WorkspaceAccessPage'
import { workspaceQueryKey, workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.listOrganizations.mockResolvedValue([
    { id: 'organization-admin', name: 'IFC', data: {}, permissions: {read: ['view'], write: ['create']}, workspaceCount: 1 },
  ])
  mocks.listMine.mockResolvedValue([
    {
      id: 'workspace-individual',
      name: 'Área individual',
      data: {},
      organizationId: null,
      organizationName: null,
      isPersonal: true,
      icon: 'lucide:user-round',
      createdByUserId: 'user-1',
      role: 'superadmin',
      pageRootId: 'page-individual',
    },
  ])
})

describe('WorkspaceAccessPage', () => {
  it('pré-seleciona a organização recebida pelo fluxo de criação de workspace', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceAccessPage />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      const [organization] = screen.getAllByRole('combobox')
      expect(organization.textContent).toContain('IFC')
    })
  })

  it('mantém a criação separada e atualiza o cache antes de abrir as configurações', async () => {
    const workspace = {
      id: 'workspace-new', name: 'Nova equipe', organizationId: 'organization-admin',
      organizationName: 'IFC', isPersonal: false, data: {}, pageRootId: 'workspace-new',
      owner: { id: 'user-1', name: 'Helder', email: 'helder@ifc.edu.br' },
    }
    mocks.create.mockResolvedValue(workspace)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    queryClient.setQueryData(workspacesQueryKey('user-1'), [{ id: 'personal', isPersonal: true }])
    render(<QueryClientProvider client={queryClient}><WorkspaceAccessPage /></QueryClientProvider>)
    await waitFor(() => expect(screen.getByRole('combobox').textContent).toContain('IFC'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome da área de trabalho' }), { target: { value: 'Nova equipe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar espaço de trabalho' }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$lang/workspaces/$workspaceId/settings/general',
      params: { lang: 'pt-br', workspaceId: 'workspace-new' },
    }))
    expect(mocks.create).toHaveBeenCalledWith({ name: 'Nova equipe', organizationId: 'organization-admin' })
    expect(queryClient.getQueryData(workspaceQueryKey('user-1', 'workspace-new'))).toEqual(workspace)
    expect(queryClient.getQueryData(workspacesQueryKey('user-1'))).toEqual([{ id: 'personal', isPersonal: true }, workspace])
    expect(currentWorkspaceSession.get('user-1')).toBe('workspace-new')
  })
})
