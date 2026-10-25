import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceVariablesPage } from './WorkspaceVariablesPage'
import { WorkspaceSettingsProvider } from '@/contexts/WorkspaceSettingsContext'
import { workspaceQueryKey } from '@/lib/workspaceQueryKeys'
import type { ApiWorkspace } from '@/services/WorkspaceService'
const mocks = vi.hoisted(() => ({ set: vi.fn(), feedback: vi.fn() }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }) }))
vi.mock('@/contexts/FeedbackContext', () => ({ useFeedback: () => mocks.feedback }))
vi.mock('@/services/WorkspaceService', () => ({ workspaceService: { setVariable: mocks.set } }))
const workspace: ApiWorkspace = { id: 'w', name: 'Equipe', data: { campaign: 'Outono', metadata: { keep: true } }, owner: { id: 'u', name: 'Ana', email: 'a@test.local' }, role: null, organizationId: null, organizationName: null, isPersonal: true, icon: 'lucide:box', pageRootId: 'r', createdByUserId: 'u', permissions: { read: ['view'], write: ['update'] } }
const clients: QueryClient[] = []
beforeEach(() => { vi.resetAllMocks(); mocks.set.mockResolvedValue(workspace) })
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0 })
function mount(data = workspace) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client)
  const key = workspaceQueryKey('u', 'w'); client.setQueryData(key, data)
  function Live() { const query = useQuery({ queryKey: key, queryFn: async () => data, staleTime: Infinity }); return <WorkspaceSettingsProvider workspace={query.data!}><WorkspaceVariablesPage /></WorkspaceSettingsProvider> }
  render(<QueryClientProvider client={client}><Live /></QueryClientProvider>); return { client, key }
}
describe('workspace text variables', () => {
  it('saves one key on blur and preserves other metadata in the shared cache', async () => {
    const { client, key } = mount()
    const input = screen.getByRole('textbox', { name: 'Valor de campaign' })
    fireEvent.change(input, { target: { value: 'Verão' } }); fireEvent.blur(input)
    await waitFor(() => expect(mocks.set).toHaveBeenCalledWith('w', 'campaign', 'Verão'))
    await waitFor(() => expect(client.getQueryData<ApiWorkspace>(key)?.data).toEqual({ campaign: 'Verão', metadata: { keep: true } }))
    expect(mocks.feedback).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }))
  })
  it('adds empty text as a value and uses null to remove a key', async () => {
    const { client, key } = mount()
    fireEvent.change(screen.getByRole('textbox', { name: 'Nova chave' }), { target: { value: 'empty' } })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar variável' }))
    await waitFor(() => expect(client.getQueryData<ApiWorkspace>(key)?.data.empty).toBe(''))
    expect(mocks.set).toHaveBeenCalledWith('w', 'empty', '')
    fireEvent.click(screen.getByRole('button', { name: 'Remover campaign' }))
    await waitFor(() => expect(client.getQueryData<ApiWorkspace>(key)?.data.campaign).toBeUndefined())
    expect(mocks.set).toHaveBeenCalledWith('w', 'campaign', null)
    expect(client.getQueryData<ApiWorkspace>(key)?.data.metadata).toEqual({ keep: true })
  })
  it('preserves the draft and allows retry after a failed blur save', async () => {
    mocks.set.mockRejectedValueOnce(new Error('offline')); const { client, key } = mount()
    const input = screen.getByRole('textbox', { name: 'Valor de campaign' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Verão' } }); fireEvent.blur(input)
    await waitFor(() => expect(mocks.feedback).toHaveBeenCalledWith(expect.objectContaining({ variant: 'error' })))
    expect(input.value).toBe('Verão'); expect(client.getQueryData<ApiWorkspace>(key)?.data.campaign).toBe('Outono')
    fireEvent.blur(input); await waitFor(() => expect(client.getQueryData<ApiWorkspace>(key)?.data.campaign).toBe('Verão'))
  })
  it('disables edits when workspace settings are read-only', () => {
    mount({ ...workspace, permissions: { read: ['view'], write: [] } })
    expect((screen.getByRole('textbox', { name: 'Valor de campaign' }) as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Adicionar variável' })).toBeNull(); expect(mocks.set).not.toHaveBeenCalled()
  })
})
