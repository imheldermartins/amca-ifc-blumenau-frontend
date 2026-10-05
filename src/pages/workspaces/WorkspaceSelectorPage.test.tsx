import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  listMine: vi.fn(),
  listOrganizations: vi.fn(),
  create: vi.fn(),
  searchUsers: vi.fn(),
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
    create: mocks.create,
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

function mountSelector() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceSelectorPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  mocks.listOrganizations.mockResolvedValue([
    { id: 'organization-1', name: 'IFC', data: {}, permissions: { read: ['view'], write: ['create'] }, workspaceCount: 2 },
  ])
  mocks.listMine.mockResolvedValue([
    {
      id: 'personal', name: 'Minha área', data: {}, organizationId: null, organizationName: null,
      isPersonal: true, icon: 'lucide:user', createdByUserId: 'user-1', pageRootId: 'personal',
      owner: { id: 'user-1', name: 'Helder', email: 'helder@ifc.edu.br' },
      permissions: { read: ['view'], write: ['update'] },
    },
    {
      id: 'workspace-admin',
      name: 'Workspace administrada',
      data: {},
      organizationId: 'organization-1',
      organizationName: 'IFC',
      isPersonal: false,
      icon: 'lucide:boxes',
      createdByUserId: 'user-1',
      owner: { id: 'user-1', name: 'Helder', email: 'helder@ifc.edu.br' },
      permissions: {read: ['view'], write: ['update']},
      pageRootId: 'page-admin',
    },
    {
      id: 'workspace-member',
      name: 'Workspace como member',
      data: {},
      organizationId: 'organization-1',
      organizationName: 'IFC',
      isPersonal: false,
      icon: 'lucide:box',
      createdByUserId: 'user-2',
      owner: { id: 'user-2', name: 'Outra pessoa', email: 'outra@ifc.edu.br' },
      role: 'member',
      pageRootId: 'page-member',
    },
  ])
})

describe('WorkspaceSelectorPage', () => {
  it('separa a área pessoal e mostra nome e email do owner', async () => {
    mountSelector()
    const personal = await screen.findByRole('heading', { name: 'Meus espaços de trabalho' })
    const organizations = await screen.findByRole('heading', { name: 'Espaços de trabalho da organização IFC' })
    expect(personal.compareDocumentPosition(organizations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(document.querySelector('aside [data-workspace-card="personal"]')).not.toBeNull()
    expect(screen.getByRole('heading', { name: /Olá, Helder\s*!/ })).not.toBeNull()
    expect(screen.getAllByText(/Helder · helder@ifc.edu.br/).length).toBeGreaterThan(0)
  })

  it('expõe configurações conforme a permissão de edição e mantém Entrar como acesso à workspace', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    window.localStorage.setItem('cubs.preferredWorkspace', JSON.stringify({
      userId: 'user-1',
      workspaceId: 'workspace-admin',
    }))
    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSelectorPage />
      </QueryClientProvider>,
    )

    await screen.findByRole('heading', { name: 'Workspace administrada' })
    const settings = within(document.querySelector('[data-workspace-card="workspace-admin"]') as HTMLElement).getByRole('button', { name: 'Configurações' })
    expect(within(document.querySelector('[data-workspace-card="workspace-member"]') as HTMLElement).queryByRole('button', { name: 'Configurações' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Entrar' })).toHaveLength(3)

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

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1))
  })

  it('abre organizações mesmo com uma workspace preferida configurada', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    window.localStorage.setItem('cubs.preferredWorkspace', JSON.stringify({
      userId: 'user-1',
      workspaceId: 'workspace-admin',
    }))
    render(
      <QueryClientProvider client={queryClient}>
        <WorkspaceSelectorPage />
      </QueryClientProvider>,
    )

    const organizations = await screen.findByRole('button', { name: 'Ir para organizações' })
    fireEvent.click(organizations)
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$lang/organizations',
      params: { lang: 'pt-br' },
    })

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledTimes(1))
  })

  it('seleciona a organização sem mover a área pessoal e permite recolher suas workspaces', async () => {
    const base = await mocks.listMine()
    mocks.listOrganizations.mockResolvedValue([
      { id: 'organization-1', name: 'IFC', data: {}, permissions: { read: ['view'], write: ['create'] }, workspaceCount: 2 },
      { id: 'organization-2', name: 'Outra organização', data: {}, permissions: { read: ['view'], write: [] }, workspaceCount: 1 },
    ])
    mocks.listMine.mockResolvedValue([...base, { ...base[1], id: 'workspace-other', name: 'Equipe externa', organizationId: 'organization-2', organizationName: 'Outra organização' }])
    mountSelector()
    fireEvent.click(await screen.findByRole('button', { name: 'Outra organização' }))
    expect(screen.getByRole('heading', { name: 'Espaços de trabalho da organização Outra organização' })).not.toBeNull()
    expect(document.querySelector('[data-workspace-card="workspace-admin"]')).toBeNull()
    expect(document.querySelector('aside [data-workspace-card="personal"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir ou recolher Outra organização' }))
    expect(screen.queryByRole('button', { name: 'Equipe externa' })).toBeNull()
    fireEvent.click(within(document.querySelector('[data-workspace-card="workspace-other"]') as HTMLElement).getByRole('button', { name: 'Entrar' }))
    expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ params: { lang: 'pt-br', workspaceId: 'workspace-other' } }))
  })

  it('mantém uma única preferência entre a área pessoal e as workspaces da organização', async () => {
    mountSelector()
    await screen.findByRole('heading', { name: 'Workspace administrada' })
    const personal = within(document.querySelector('[data-workspace-card="personal"]') as HTMLElement).getByRole('switch')
    const organization = within(document.querySelector('[data-workspace-card="workspace-admin"]') as HTMLElement).getByRole('switch')
    fireEvent.click(organization)
    expect(organization.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(personal)
    expect(personal.getAttribute('aria-checked')).toBe('true')
    expect(organization.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(personal)
    expect(personal.getAttribute('aria-checked')).toBe('false')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('cria na própria tela, pré-seleciona a organização e preserva a área pessoal', async () => {
    const base = await mocks.listMine()
    mocks.create.mockResolvedValue({ ...base[1], id: 'workspace-new', name: 'Nova equipe' })
    mountSelector()
    fireEvent.click(await screen.findByRole('button', { name: 'Criar espaço de trabalho em IFC' }))
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(within(dialog).getByRole('combobox').textContent).toContain('IFC'))
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da área de trabalho' }), { target: { value: '  Nova equipe  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar espaço de trabalho' }))
    await screen.findByRole('heading', { name: 'Nova equipe' })
    expect(mocks.create).toHaveBeenCalledWith({ name: 'Nova equipe', organizationId: 'organization-1' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelector('aside [data-workspace-card="personal"]')).not.toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('não oferece criação sem permissão, incluindo organizações sem workspace', async () => {
    mocks.listOrganizations.mockResolvedValue([{ id: 'organization-empty', name: 'Organização vazia', data: {}, permissions: { read: ['view'], write: [] }, workspaceCount: 0 }])
    const base = await mocks.listMine()
    mocks.listMine.mockResolvedValue([base[0]])
    mountSelector()
    await screen.findByRole('button', { name: 'Organização vazia' })
    expect(screen.queryByRole('button', { name: 'Criar novo espaço de trabalho' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Criar espaço de trabalho em/ })).toBeNull()
    expect(screen.getByText('Esta organização ainda não tem espaços de trabalho disponíveis para você.')).not.toBeNull()
  })

  it('conserva o formulário e os cards quando a criação falha', async () => {
    mocks.create.mockRejectedValue(new Error('Falha ao salvar'))
    mountSelector()
    fireEvent.click(await screen.findByRole('button', { name: 'Criar espaço de trabalho em IFC' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da área de trabalho' }), { target: { value: 'Equipe' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar espaço de trabalho' }))
    await waitFor(() => expect(within(dialog).getByRole('alert')).not.toBeNull())
    expect((within(dialog).getByRole('textbox') as HTMLInputElement).value).toBe('Equipe')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('mantém o diálogo aberto e impede outro envio enquanto a criação está pendente', async () => {
    const base = await mocks.listMine()
    let finishCreation!: (workspace: unknown) => void
    mocks.create.mockReturnValue(new Promise((resolve) => { finishCreation = resolve }))
    mountSelector()
    fireEvent.click(await screen.findByRole('button', { name: 'Criar espaço de trabalho em IFC' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Nome da área de trabalho' }), { target: { value: 'Equipe pendente' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar espaço de trabalho' }))
    const saving = await within(dialog).findByRole('button', { name: 'Criando...' })
    expect((saving as HTMLButtonElement).disabled).toBe(true)
    expect((within(dialog).getByRole('textbox') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    expect(screen.getByRole('dialog')).toBe(dialog)
    fireEvent.click(saving)
    expect(mocks.create).toHaveBeenCalledTimes(1)
    finishCreation({ ...base[1], id: 'workspace-pending', name: 'Equipe pendente' })
    await screen.findByRole('heading', { name: 'Equipe pendente' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
