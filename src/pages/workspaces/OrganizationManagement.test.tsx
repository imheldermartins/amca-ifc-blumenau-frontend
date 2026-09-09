import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  listMine: vi.fn(),
  listOrganizations: vi.fn(),
  searchUsers: vi.fn(),
  addUser: vi.fn(),
  createOrganization: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useParams: () => ({ lang: 'pt-br' }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', name: 'Helder', email: 'helder@ifc.edu.br' } }),
}))

vi.mock('@/services/WorkspaceService', () => ({
  workspaceService: {
    listMine: mocks.listMine,
    listOrganizations: mocks.listOrganizations,
    searchOrganizationWorkspaceUsers: mocks.searchUsers,
    addOrganizationWorkspaceUser: mocks.addUser,
    createOrganization: mocks.createOrganization,
  },
}))

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: { icon: string; className?: string }) => (
    <span data-icon={icon} {...props} />
  ),
}))

import { OrganizationManagement } from './OrganizationManagement'

function renderPage(onLeave?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizationManagement onLeave={onLeave} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listOrganizations.mockResolvedValue([
    { id: 'organization-admin', name: 'IFC', data: {}, role: 'superadmin', workspaceCount: 2 },
    { id: 'organization-member', name: 'Projeto aberto', data: {}, role: 'member', workspaceCount: 1 },
  ])
  mocks.listMine.mockResolvedValue([
    {
      id: 'workspace-individual',
      name: 'Área individual',
      data: {},
      organizationId: null,
      organizationName: null,
      icon: 'lucide:user-round',
      createdByUserId: 'user-1',
      role: 'superadmin',
      pageRootId: 'page-individual',
    },
    {
      id: 'workspace-ifc',
      name: 'IFC Blumenau',
      data: {},
      organizationId: 'organization-admin',
      organizationName: 'IFC',
      icon: 'lucide:boxes',
      createdByUserId: 'user-1',
      role: 'superadmin',
      pageRootId: 'page-ifc',
    },
    {
      id: 'workspace-project',
      name: 'Base compartilhada',
      data: {},
      organizationId: 'organization-member',
      organizationName: 'Projeto aberto',
      icon: 'lucide:box',
      createdByUserId: 'user-2',
      role: 'member',
      pageRootId: 'page-project',
    },
  ])
  mocks.searchUsers.mockResolvedValue([
    {
      id: 'user-2',
      name: 'Ana',
      email: 'ana@example.com',
      organizationRole: null,
      workspaceRole: null,
    },
    {
      id: 'user-3',
      name: 'Anabela',
      email: 'anabela@example.com',
      organizationRole: null,
      workspaceRole: null,
    },
  ])
})

describe('OrganizationManagement', () => {
  it('separa a listagem das organizações dos detalhes e cria workspace na organização selecionada', async () => {
    const onLeave = vi.fn()
    renderPage(onLeave)

    expect(await screen.findByRole('button', { name: /IFC/ })).not.toBeNull()
    expect(screen.getByRole('button', { name: /Projeto aberto/ })).not.toBeNull()
    expect(screen.getAllByText('IFC Blumenau').length).toBeGreaterThan(0)
    expect(screen.queryByText('Vincular workspace')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Criar workspace' }))

    expect(onLeave).toHaveBeenCalledOnce()
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$lang/workspaces/new',
      params: { lang: 'pt-br' },
      search: { tab: 'create', organization: 'organization-admin' },
    })
  })

  it('só consulta e exibe um usuário quando o e-mail completo coincide exatamente', async () => {
    renderPage()

    const email = await screen.findByRole('textbox', { name: 'E-mail do usuário' })
    expect(mocks.searchUsers).not.toHaveBeenCalled()

    fireEvent.change(email, { target: { value: 'ana@' } })
    expect(mocks.searchUsers).not.toHaveBeenCalled()

    fireEvent.change(email, { target: { value: 'ANA@example.com' } })

    await waitFor(() => expect(mocks.searchUsers).toHaveBeenCalledWith(
      'organization-admin',
      'workspace-ifc',
      'ana@example.com',
    ))
    expect(await screen.findByText('Ana')).not.toBeNull()
    expect(screen.queryByText('Anabela')).toBeNull()
  })

  it('lista organizações como member sem expor controles administrativos', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Projeto aberto/ }))

    expect(screen.getByText('Base compartilhada')).not.toBeNull()
    expect(screen.getByText('Somente superadmins da organização podem adicionar usuários.')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Criar workspace' })).toBeNull()
    expect(screen.queryByRole('textbox', { name: 'E-mail do usuário' })).toBeNull()
  })
})
