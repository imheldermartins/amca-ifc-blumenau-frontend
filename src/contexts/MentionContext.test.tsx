import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { MentionTextField } from 'cubs-components'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MentionScopeProvider } from './MentionContext'
import { useMention } from '@/hooks/useMention'
import { mentionId, mentionToken, type MentionCatalog, type MentionScope } from '@/shared/mentions'

const mocks = vi.hoisted(() => ({ catalog: vi.fn(), resolve: vi.fn() }))
const actor = { id: '01M00000000000000000000001', name: 'Ana', email: 'ana@test.local' }
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: { id: '01M00000000000000000000001', name: 'Ana', email: 'ana@test.local' } }) }))
vi.mock('@/services/MentionService', () => ({ mentionService: mocks }))
const ws = '01M00000000000000000000002'
const catalog: MentionCatalog = { users: [{ id: '01M00000000000000000000003', name: 'Bruno', email: 'bruno@test.local' }], workspace: { id: ws, name: 'Equipe', data: { campaign: 'Outono' } } }
function Probe() {
  const mention = useMention()
  return <><ol>{mention.options.map((option) => <li key={option.id}>{option.section}: {option.label}</li>)}</ol><output>{mention.resolve(`@{${mentionId('workspace', ws, 'data.campaign')}}`)}</output></>
}
const clients: QueryClient[] = []
beforeEach(() => { vi.resetAllMocks(); mocks.catalog.mockResolvedValue(catalog); mocks.resolve.mockResolvedValue({ [mentionId('workspace', ws, 'data.campaign')]: 'Outono' }) })
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; vi.useRealTimers() })
function mount(pageId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client)
  const tree = (id: string) => <QueryClientProvider client={client}><MentionScopeProvider scope={{ pageId: id }}><Probe /></MentionScopeProvider></QueryClientProvider>
  return { ...render(tree(pageId)), tree, client }
}
describe('mention context', () => {
  it.each([{}, { pageId: ws }, { workspaceId: ws }, { organizationId: ws }])('provides @hoje without waiting for a catalog in scope %j and saves only its ISO instant', async (scope: MentionScope) => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-26T15:04:59.123Z'))
    mocks.catalog.mockReturnValue(new Promise(() => {}))
    const commit = vi.fn()
    function TodayInput() {
      const mention = useMention(), [text, setText] = useState('')
      return <MentionTextField value={text} onValueChange={setText} onBlur={() => commit(text)} mentions={{
        options: mention.options, resolve: mention.resolve, token: mentionToken, label: 'Menções', empty: 'Vazio',
      }} />
    }
    const client = new QueryClient(); clients.push(client)
    const tree = () => <QueryClientProvider client={client}><MentionScopeProvider scope={scope}><TodayInput /></MentionScopeProvider></QueryClientProvider>
    const view = render(tree())
    const input = screen.getByRole('combobox') as HTMLInputElement
    act(() => input.focus()); fireEvent.change(input, { target: { value: '@hoje' } })
    fireEvent.click(screen.getByRole('option', { name: 'hoje 26/10/2026 às 12:04' }))
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)))
    act(() => input.blur())
    expect(commit).toHaveBeenCalledWith('@{2026-10-26T15:04:59.123Z}')
    vi.setSystemTime(new Date('2026-11-27T20:00:00.000Z')); view.rerender(tree())
    expect(input.value).toBe('26/10/2026 às 12:04')
    expect(mocks.resolve.mock.calls.flatMap((call) => call[1])).not.toContain('2026-10-26T15:04:59.123Z')
  })
  it('includes current page properties with stable ids and configured names', async () => {
    mocks.catalog.mockResolvedValue({ users: [], page: { id: ws, title: 'Linha', columns: [{ id: actor.id, name: 'Cliente', value: 'Ana' }] } })
    mount(ws)
    await screen.findByText('Página atual: Cliente')
    expect(mocks.resolve).toHaveBeenCalledWith({ pageId: ws }, expect.arrayContaining([mentionId('pages', ws, `columns.${actor.id}`)]))
  })
  it('keeps the authenticated user first with (Eu) and localizes typed sections', async () => {
    mount(ws)
    await screen.findByText('Workspace: campaign')
    expect(screen.getAllByRole('listitem')[0]?.textContent).toBe('Usuários: Ana (Eu) · Nome')
    expect(screen.getAllByRole('listitem')[1]?.textContent).toBe('Usuários: Ana (Eu) · E-mail')
    expect(mocks.catalog).toHaveBeenCalledWith({ pageId: ws })
    expect(screen.getByRole('status').textContent).toBe('Outono')
  })
  it('drops the previous scope immediately and reloads values after cache invalidation', async () => {
    const view = mount(ws); await screen.findByText('Workspace: campaign')
    mocks.catalog.mockResolvedValue({ users: [actor] }); mocks.resolve.mockResolvedValue({})
    view.rerender(view.tree(actor.id))
    expect(screen.queryByText('Workspace: campaign')).toBeNull()
    await waitFor(() => expect(mocks.catalog).toHaveBeenCalledWith({ pageId: actor.id }))
    mocks.catalog.mockResolvedValue(catalog); mocks.resolve.mockResolvedValue({ [mentionId('workspace', ws, 'data.campaign')]: 'Verão' })
    await view.client.invalidateQueries({ queryKey: ['mentions'] })
    await screen.findByText('Workspace: campaign'); await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Verão'))
  })
})
