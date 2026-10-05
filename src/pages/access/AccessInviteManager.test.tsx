import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ current: vi.fn(), roles: vi.fn(), catalog: vi.fn(), members: vi.fn(), invites: vi.fn(), searchEmail: vi.fn(), createInvite: vi.fn(), removeMember: vi.fn(), removeInvite: vi.fn(), assign: vi.fn(), navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }))
vi.mock('@/services/AccessService', async (original) => ({ ...await original<typeof import('@/services/AccessService')>(), accessService: mocks }))
import { i18n } from '@/lib/i18n'
import type { AccessMember, AccessRole, AccessScope, ScopeAccess } from '@/services/AccessService'
import { AccessMembersPanel } from './AccessMembersPanel'
import { AccessInviteManager } from './AccessInviteManager'
const grant = { scope: 'workspace', scopeId: 'workspace-1', ownerId: 'owner', isOwner: true, isMember: true, roleId: null, roleName: null,
  permissions: { read: ['view', 'members', 'roles'], write: ['add_members', 'promote_members', 'remove_members', 'create_wk_roles'] } } satisfies ScopeAccess
const reader = { id: 'role-reader', name: 'Leitura', roles: { read: ['view'], write: [] }, isDefault: true, systemKey: null, created_at: '', updated_at: '' } satisfies AccessRole
const editor = { ...reader, id: 'role-editor', name: 'Equipe', isDefault: false }
const ana = { id: 'reader', membershipId: 'membership-reader', name: 'Ana', email: 'ana@example.test', roleId: reader.id, roleName: 'Padrão', permissions: reader.roles } satisfies AccessMember
const owner = { ...ana, id: 'owner', name: 'Helder', email: 'helder@example.test' }
const invitation = { invite: { id: 'invite-1' }, inviteUrl: null, notificationPending: false }
function mount(element = <AccessMembersPanel scope="workspace" id="workspace-1" />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
  return client
}
const searchInput = () => screen.getByRole('searchbox', { name: i18n('access.search-collaborators') })
const find = async (email = 'person@example.test') => { fireEvent.change(searchInput(), { target: { value: email } }); fireEvent.click(screen.getByRole('button', { name: i18n('access.search-email') })); await screen.findByText(i18n('access.account-found')) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.current.mockResolvedValue(grant); mocks.catalog.mockResolvedValue({ workspace: grant.permissions })
  mocks.roles.mockResolvedValue([reader, editor]); mocks.invites.mockResolvedValue([]); mocks.members.mockResolvedValue([ana, owner])
  mocks.searchEmail.mockResolvedValue({ found: true, isMember: false, user: { id: 'candidate', name: 'João', email: 'person@example.test', verified: true } })
  mocks.createInvite.mockResolvedValue(invitation); mocks.removeMember.mockResolvedValue({ saved: true }); mocks.assign.mockResolvedValue({ saved: true })
})
describe('gestão compartilhada de colaboradores', () => {
  it.each(['organization', 'workspace', 'page'] as AccessScope[])('preserva owner no topo, inclusive ao filtrar em %s', async (scope) => {
    mount(<AccessMembersPanel scope={scope} id="scope-1" />)
    const list = await screen.findByRole('list', { name: i18n('access.members') })
    await screen.findByText('Helder')
    expect(within(list).getAllByRole('listitem')[0].textContent).toContain('Helder')
    expect(within(list).getAllByRole('listitem')[0].querySelector('button')).toBeNull()
    fireEvent.change(searchInput(), { target: { value: 'no-match' } })
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    expect(within(list).getByText('Helder')).toBeTruthy()
  })
  it('envia para e-mail normalizado com role e expiração, sem incluir membro antes do aceite', async () => {
    mocks.createInvite.mockResolvedValue({ ...invitation, notificationPending: true })
    mount(); await screen.findByText('Ana'); await find(' Person@Example.Test ')
    fireEvent.click(screen.getByRole('button', { name: i18n('access.send-invite') }))
    await waitFor(() => expect(mocks.createInvite).toHaveBeenCalledWith('workspace', 'workspace-1', { recipientEmail: 'person@example.test', roleId: 'role-reader', expiresIn: '24h', acceptanceLimit: 1 }))
    await screen.findByText(i18n('access.notification-pending'))
    expect(within(screen.getByRole('list', { name: i18n('access.members') })).queryByText('João')).toBeNull()
    expect(screen.getByRole('complementary', { name: i18n('access.invites') })).toBeTruthy()
  })
  it('descarta resposta antiga da busca quando o e-mail muda', async () => {
    let resolve!: (value: object) => void
    mocks.searchEmail.mockReturnValue(new Promise((done) => { resolve = done }))
    mount(); await screen.findByText('Ana')
    fireEvent.change(searchInput(), { target: { value: 'person@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: i18n('access.search-email') }))
    await waitFor(() => expect(mocks.searchEmail).toHaveBeenCalled())
    fireEvent.change(searchInput(), { target: { value: 'other@example.test' } })
    resolve({ found: true, isMember: false, user: { id: 'candidate' } })
    await waitFor(() => expect(screen.queryByRole('button', { name: i18n('access.send-invite') })).toBeNull())
    expect(mocks.createInvite).not.toHaveBeenCalled()
  })
  it('uma conta já vinculada não pode receber novo convite', async () => {
    mocks.searchEmail.mockResolvedValue({ found: true, isMember: true, user: null })
    mount(); await screen.findByText('Ana')
    fireEvent.change(searchInput(), { target: { value: 'ana@example.test' } })
    fireEvent.click(screen.getByRole('button', { name: i18n('access.search-email') }))
    await screen.findByText(i18n('access.already-member'))
    expect(screen.queryByRole('button', { name: i18n('access.send-invite') })).toBeNull()
  })
  it('impede delegar uma role acima das permissões atuais', async () => {
    mount(<AccessInviteManager scope="workspace" id="workspace-1" access={grant} roles={[{ ...reader, roles: { read: ['view'], write: ['delete'] } }]} onSearchChange={vi.fn()} onInvited={async () => {}} />)
    await find()
    expect((screen.getByRole('button', { name: i18n('access.send-invite') }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(i18n('access.create-role-first'))).toBeTruthy()
  })
  it('leitor pode filtrar, mas não convidar, alterar roles ou remover', async () => {
    mocks.current.mockResolvedValue({ ...grant, permissions: { read: ['view', 'members'], write: [] } })
    mount(); await screen.findByText('Ana')
    expect(screen.queryByRole('button', { name: i18n('access.search-email') })).toBeNull()
    expect(screen.queryByRole('button', { name: i18n('access.invite-by-link') })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Permissões de Ana' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ações de Ana' })).toBeNull()
  })
  it('troca role na seleção sem descrições e atualiza a lista compartilhada', async () => {
    const changed = vi.fn()
    mount(<AccessMembersPanel scope="page" id="page-1" onMembersChanged={changed} />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Permissões de Ana' }))
    const dialog = screen.getByRole('dialog', { name: i18n('access.permissions') })
    expect(within(dialog).getAllByRole('radio')).toHaveLength(2)
    expect(within(dialog).queryByText(/Pode visualizar|template existente|Acesso padrão/)).toBeNull()
    fireEvent.click(within(dialog).getByLabelText('Equipe'))
    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('page', 'page-1', 'reader', 'role-editor'))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('não altera cache nem fecha confirmação quando a API nega remoção', async () => {
    mocks.removeMember.mockRejectedValue(new Error('Forbidden'))
    const client = mount()
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Ana' }))
    fireEvent.click(screen.getByRole('button', { name: i18n('access.remove-collaborator') }))
    const dialog = screen.getByRole('dialog', { name: i18n('access.remove-collaborator') })
    expect(mocks.removeMember).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: i18n('access.remove-collaborator') }))
    await within(dialog).findByRole('alert')
    expect(client.getQueryData(['access', 'owner', 'workspace', 'workspace-1', 'members'])).toEqual([ana, owner])
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('remoção confirmada atualiza lista e audiência da PageShell', async () => {
    const changed = vi.fn()
    mocks.removeMember.mockImplementation(async () => { mocks.members.mockResolvedValue([owner]); return { saved: true } })
    mount(<AccessMembersPanel scope="page" id="page-1" onMembersChanged={changed} />)
    await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Ana' }))
    fireEvent.click(screen.getByRole('button', { name: i18n('access.remove-collaborator') }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: i18n('access.remove-collaborator') }))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
    expect(screen.queryByText('Ana')).toBeNull()
  })
  it('histórico filtra convites pendentes e aceitos sem conceder acesso', async () => {
    mocks.invites.mockResolvedValue([
      { id: 'i1', recipientEmail: 'pending@example.test', roleName: 'Padrão', status: 'pending', acceptanceCount: 0, acceptanceLimit: 1 },
      { id: 'i2', recipientEmail: 'accepted@example.test', roleName: 'Padrão', status: 'accepted', acceptanceCount: 1, acceptanceLimit: 1 },
    ])
    mount(); await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: /Convites/ }))
    const aside = await screen.findByRole('complementary')
    expect(within(aside).getByText('pending@example.test')).toBeTruthy()
    expect(within(aside).queryByText('accepted@example.test')).toBeNull()
    fireEvent.click(within(aside).getByRole('button', { name: i18n('access.status.accepted') }))
    expect(within(aside).getByText('accepted@example.test')).toBeTruthy()
    expect(within(aside).queryByRole('button', { name: i18n('access.expire-link') })).toBeNull()
    expect(mocks.createInvite).not.toHaveBeenCalled()
  })
  it('gera link com expiração e um aceite, sem enviar convite por e-mail', async () => {
    mount(); await screen.findByText('Ana')
    fireEvent.click(screen.getByRole('button', { name: i18n('access.invite-by-link') }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: i18n('access.create-link') }))
    await waitFor(() => expect(mocks.createInvite).toHaveBeenCalledWith('workspace', 'workspace-1', { recipientEmail: null, roleId: 'role-reader', expiresIn: '24h', acceptanceLimit: 1 }))
  })
})
