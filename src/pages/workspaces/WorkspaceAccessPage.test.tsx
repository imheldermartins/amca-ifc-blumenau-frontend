import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  querySet: vi.fn(),
  listMine: vi.fn(),
  listOrganizations: vi.fn(),
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
    create: vi.fn(),
    join: vi.fn(),
    validateKey: vi.fn(),
  },
}))

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: { icon: string; className?: string }) => (
    <span data-icon={icon} {...props} />
  ),
}))

import { WorkspaceAccessPage } from './WorkspaceAccessPage'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listOrganizations.mockResolvedValue([
    { id: 'organization-admin', name: 'IFC', data: {}, role: 'superadmin', workspaceCount: 1 },
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
})
