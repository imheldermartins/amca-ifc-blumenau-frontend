import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { NewOrganizationPage } from './OrganizationPages'
import { OrganizationWorkspacesPage } from './OrganizationWorkspacesPage'
import { OrganizationSettingsHeader } from './Layout/OrganizationSettingsHeader'
import { OrganizationVariablesPage, OrganizationMembersPage, OrganizationPermissionsPage } from './OrganizationSettingsPages'
import { OrganizationSettingsProvider } from '@/hooks/useOrganizationSettings'
import { FeedbackProvider } from '@/contexts/FeedbackContext'
import { ModalProvider } from '@/contexts/ModalContext'
import type { ApiOrganization } from '@/services/WorkspaceService'
import { workspacePreference } from '@/lib/workspacePreference'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), listMine: vi.fn(), organizationWorkspaces: vi.fn(), create: vi.fn(), createOrganization: vi.fn(), updateOrganization: vi.fn(), setOrganizationVariable: vi.fn(), request: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate, Navigate: ({ to }: { to: string }) => <p data-testid="redirect">{to}</p> }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'person', name: 'Ana', email: 'ana@test.local' } }) }))
vi.mock('@/services/WorkspaceService', () => ({ workspaceService: mocks }))
vi.mock('@/services/AccessService', async (original) => ({ ...await original<typeof import('@/services/AccessService')>(), accessService: { request: mocks.request } }))
vi.mock('@/pages/access/AccessPages', async (original) => ({ ...await original<typeof import('@/pages/access/AccessPages')>(), AccessMembersPage: ({ scope, id, embedded }: { scope: string; id: string; embedded: boolean }) => <p>{`${scope}:${id}:${embedded}`}</p>, RolesPage: () => <p>Roles existentes</p> }))
const organization: ApiOrganization = { id: 'org', name: 'Instituto Cub', data: { campaign: 'Outono', metadata: { keep: true } }, role: null, workspaceCount: 1, permissions: { read: ['view', 'workspaces'], write: [] } }
const clients: QueryClient[] = []
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear()
  mocks.listMine.mockResolvedValue([]); mocks.organizationWorkspaces.mockResolvedValue([{ id: 'wk', name: 'Pesquisa', icon: 'lucide:box', canEnter: false, isMember: false }]); mocks.request.mockResolvedValue({ notificationPending: false })
  mocks.updateOrganization.mockImplementation(async (id, name) => ({ ...organization, id, name })); mocks.setOrganizationVariable.mockResolvedValue(organization)
})
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0 })
function mount(children: ReactNode, data: ApiOrganization = organization) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client)
  client.setQueryData(['organization', 'person', data.id], data); client.setQueryData(['organizations', 'person'], [data])
  return { ...render(<QueryClientProvider client={client}><FeedbackProvider><ModalProvider><OrganizationSettingsProvider value={data}>{children}</OrganizationSettingsProvider></ModalProvider></FeedbackProvider></QueryClientProvider>), client }
}
describe('organization settings', () => {
  it('edits the native title on blur without an organization icon or Open button', async () => {
    const { client, container } = mount(<OrganizationSettingsHeader section="Variáveis" />, { ...organization, permissions: { read: ['view'], write: ['update'] } })
    const input = screen.getByRole('textbox', { name: 'Nome da organização' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: ' Novo instituto ' } }); expect(mocks.updateOrganization).not.toHaveBeenCalled()
    fireEvent.blur(input); await waitFor(() => expect(mocks.updateOrganization).toHaveBeenCalledWith('org', 'Novo instituto'))
    expect(client.getQueryData(['organization', 'person', 'org'])).toMatchObject({ name: 'Novo instituto' })
    expect(client.getQueryData<ApiOrganization[]>(['organizations', 'person'])?.[0]?.name).toBe('Novo instituto')
    expect(container.querySelector('header button')).toBeNull(); expect(input.className).toContain('border-0')
  })
  it('preserves a failed draft for retry, handles Escape and does not send whitespace names', async () => {
    mocks.updateOrganization.mockRejectedValueOnce(new Error('offline'))
    mount(<OrganizationSettingsHeader section="Variáveis" />, { ...organization, permissions: { read: ['view'], write: ['update'] } })
    const input = screen.getByRole('textbox') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Rascunho' } }); fireEvent.blur(input)
    await screen.findByText('Não foi possível salvar o nome da organização.')
    expect(input.value).toBe('Rascunho'); fireEvent.blur(input)
    await waitFor(() => expect(mocks.updateOrganization).toHaveBeenCalledTimes(2))
    fireEvent.change(input, { target: { value: ' ' } }); fireEvent.blur(input)
    await screen.findByRole('alert'); expect(mocks.updateOrganization).toHaveBeenCalledTimes(2)
    act(() => input.focus()); fireEvent.keyDown(input, { key: 'Escape' }); expect(input.value).toBe('Instituto Cub')
  })
  it('does not grant workspace entry or settings from organization catalog membership', async () => {
    mount(<OrganizationWorkspacesPage />)
    const row = (await screen.findByText('Pesquisa')).closest('li')!
    expect(within(row).queryByRole('switch')).toBeNull(); expect(screen.queryByRole('button', { name: 'Novo espaço de trabalho' })).toBeNull()
    fireEvent.click(within(row).getByRole('button', { name: 'Solicitar acesso' }))
    await waitFor(() => expect(mocks.request).toHaveBeenCalledWith('workspace', 'wk'))
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
  it('preserves preference and workspace settings actions when entry is allowed', async () => {
    mocks.organizationWorkspaces.mockResolvedValue([{ id: 'wk', name: 'Pesquisa', icon: 'lucide:box', canEnter: true, isMember: true }])
    mocks.listMine.mockResolvedValue([{ id: 'wk', name: 'Pesquisa', permissions: { read: ['view'], write: ['update'] } }])
    mount(<OrganizationWorkspacesPage />)
    fireEvent.click(await screen.findByRole('switch')); expect(workspacePreference.get('person')).toBe('wk')
    fireEvent.click(screen.getByRole('button', { name: 'Configurar Pesquisa' }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/$lang/workspaces/$workspaceId/settings/general', params: { lang: 'pt-br', workspaceId: 'wk' } })
    mocks.navigate.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Entrar em Pesquisa' }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/$lang/workspace/$workspaceId', params: { lang: 'pt-br', workspaceId: 'wk' } })
  })
  it('keeps the workspace catalog private without read.workspaces', () => {
    mount(<OrganizationWorkspacesPage />, { ...organization, permissions: { read: ['view'], write: [] } })
    expect(mocks.organizationWorkspaces).not.toHaveBeenCalled(); expect(mocks.listMine).not.toHaveBeenCalled()
  })
  it('uses the same text variable editor and updates only organization.data', async () => {
    const { client } = mount(<OrganizationVariablesPage />, { ...organization, permissions: { read: ['view'], write: ['update'] } })
    const input = screen.getByRole('textbox', { name: 'Valor de campaign' })
    fireEvent.change(input, { target: { value: 'Verão' } }); fireEvent.blur(input)
    await waitFor(() => expect(mocks.setOrganizationVariable).toHaveBeenCalledWith('org', 'campaign', 'Verão'))
    await waitFor(() => expect(client.getQueryData<ApiOrganization>(['organization', 'person', 'org'])?.data).toEqual({ campaign: 'Verão', metadata: { keep: true } }))
    expect(client.getQueryData(['workspace', 'person', 'org'])).toBeUndefined()
  })
  it('reuses members and roles within the organization scope, with permission guards', () => {
    const view = mount(<><OrganizationMembersPage /><OrganizationPermissionsPage /></>, { ...organization, permissions: { read: ['view', 'members', 'roles'], write: [] } })
    expect(screen.getByText('organization:org:true')).toBeTruthy(); expect(screen.getByText('Roles existentes')).toBeTruthy()
    view.unmount(); mount(<OrganizationPermissionsPage />)
    expect(screen.getByTestId('redirect').textContent).toBe('/$lang/access-denied')
  })
  it('creates an organization and navigates directly to its fixed id route', async () => {
    mocks.createOrganization.mockResolvedValue({ ...organization, id: 'created' }); mount(<NewOrganizationPage />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Nome da organização' }), { target: { value: 'Nova organização' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar organização' }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: '/$lang/organizations/$organizationId', params: { lang: 'pt-br', organizationId: 'created' } }))
  })
})
