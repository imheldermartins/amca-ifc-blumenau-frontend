import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { PageFavoriteButton } from './PageFavoriteButton'
import { PageFavoritesSection } from './PageFavoritesSection'
import { FeedbackProvider } from '@/contexts/FeedbackContext'
import { favoriteKeys } from '@/hooks/usePageFavorites'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'

const api = vi.hoisted(() => ({ list: vi.fn(), state: vi.fn(), set: vi.fn(), actor: { id: 'user' } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: api.actor }) }))
vi.mock('@/services/PageFavoriteService', () => ({ pageFavoriteService: api }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ params, children, onClick, search: _search, ...props }: { params: { lang: string; pageId: string }; children: ReactNode; onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void; search?: unknown }) => <a {...props} href={`/${params.lang}/page/${params.pageId}`} onClick={(event) => { event.preventDefault(); onClick(event) }}>{children}</a> }))
const item = { pageId: 'page', title: 'Projeto', workspaceId: 'workspace', workspaceName: 'Equipe', createdAt: '2026-10-25 10:00:00' }
const clients: QueryClient[] = []
beforeEach(() => {
  vi.resetAllMocks(); window.localStorage.clear(); window.sessionStorage.clear(); api.actor = { id: 'user' }
  api.state.mockResolvedValue({ pageId: 'page', favorite: false })
  api.list.mockResolvedValue({ items: [item], total: 1, nextCursor: null })
  api.set.mockImplementation(async (pageId, favorite) => ({ pageId, favorite }))
})
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0 })
function mount(content: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }); clients.push(client)
  const tree = (children: ReactNode) => <QueryClientProvider client={client}><FeedbackProvider>{children}</FeedbackProvider></QueryClientProvider>
  return { ...render(tree(content)), client, tree }
}
describe('personal favorites UI', () => {
  it('updates the toggle while saving and allows removing it without reloading', async () => {
    let finish!: (saved: { pageId: string; favorite: boolean }) => void
    api.set.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { client } = mount(<PageFavoriteButton pageId="page" title="Projeto" />)
    const star = await screen.findByRole('button', { name: 'Adicionar Projeto aos favoritos' })
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(star)
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('page', true))
    expect(star.getAttribute('aria-pressed')).toBe('true')
    expect((star as HTMLButtonElement).disabled).toBe(true)
    await act(async () => finish({ pageId: 'page', favorite: true }))
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))

    fireEvent.click(star)
    await waitFor(() => expect(api.set).toHaveBeenLastCalledWith('page', false))
    expect(star.getAttribute('aria-pressed')).toBe('false')
    await act(async () => finish({ pageId: 'page', favorite: false }))
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))
    expect(star.getAttribute('aria-label')).toBe('Adicionar Projeto aos favoritos')
    expect(client.getQueryData(favoriteKeys.page('user', 'page'))).toEqual({ pageId: 'page', favorite: false })
  })
  it('pins from the page header and shares the confirmed state with its list', async () => {
    const { client } = mount(<PageFavoriteButton pageId="page" title="Projeto" />)
    const star = await screen.findByRole('button', { name: 'Adicionar Projeto aos favoritos' })
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(star)
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('page', true))
    expect((await screen.findByRole('button', { name: 'Remover Projeto dos favoritos' })).getAttribute('aria-pressed')).toBe('true')
    expect(client.getQueryData(favoriteKeys.page('user', 'page'))).toEqual({ pageId: 'page', favorite: true })
  })
  it('shows a recoverable error without claiming the failed bookmark was saved', async () => {
    api.set.mockRejectedValue(new Error('offline')); mount(<PageFavoriteButton pageId="page" title="Projeto" />)
    const star = await screen.findByRole('button', { name: 'Adicionar Projeto aos favoritos' })
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(star)
    await screen.findByText('Não foi possível atualizar o favorito.')
    expect(star.getAttribute('aria-pressed')).toBe('false')
  })
  it('restores the selected toggle when removing the favorite fails', async () => {
    api.state.mockResolvedValue({ pageId: 'page', favorite: true })
    let fail!: (error: Error) => void
    api.set.mockImplementation(() => new Promise((_resolve, reject) => { fail = reject }))
    const { client } = mount(<PageFavoriteButton pageId="page" title="Projeto" />)
    const star = await screen.findByRole('button', { name: 'Remover Projeto dos favoritos' })
    await waitFor(() => expect((star as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(star)
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('page', false))
    expect(star.getAttribute('aria-pressed')).toBe('false')
    await act(async () => fail(new Error('offline')))
    await screen.findByText('Não foi possível atualizar o favorito.')
    expect(star.getAttribute('aria-pressed')).toBe('true')
    expect((star as HTMLButtonElement).disabled).toBe(false)
    expect(client.getQueryData(favoriteKeys.page('user', 'page'))).toEqual({ pageId: 'page', favorite: true })
  })
  it('collapses the section, restores that preference and does not fetch a closed list', async () => {
    const view = mount(<PageFavoritesSection />); await screen.findByRole('link', { name: 'Projeto Equipe' })
    const toggle = screen.getByRole('button', { name: 'Favoritos' }); fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false'); expect(screen.queryByRole('region', { name: 'Favoritos' })).toBeNull()
    view.unmount(); api.list.mockClear(); mount(<PageFavoritesSection />)
    expect(screen.getByRole('button', { name: 'Favoritos' }).getAttribute('aria-expanded')).toBe('false'); expect(api.list).not.toHaveBeenCalled()
  })
  it('loads additional pages, navigates by canonical page id and selects the authorized workspace', async () => {
    api.list.mockResolvedValueOnce({ items: [item], total: 2, nextCursor: 'next' }).mockResolvedValueOnce({ items: [{ ...item, pageId: 'second', title: 'Outra' }], total: 2, nextCursor: null })
    mount(<PageFavoritesSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Carregar mais favoritos' }))
    await screen.findByRole('link', { name: 'Outra Equipe' }); expect(api.list).toHaveBeenCalledWith('next')
    const link = screen.getByRole('link', { name: 'Projeto Equipe' }); expect(link.getAttribute('href')).toBe('/pt-br/page/page')
    fireEvent.click(link); expect(currentWorkspaceSession.get('user')).toBe('workspace')
  })
  it('removes a favorite without navigating and keeps the list open', async () => {
    mount(<PageFavoritesSection />)
    const remove = await screen.findByRole('button', { name: 'Remover Projeto dos favoritos' })
    api.list.mockResolvedValue({ items: [], total: 0, nextCursor: null }); fireEvent.click(remove)
    await waitFor(() => expect(api.set).toHaveBeenCalledWith('page', false))
    await screen.findByText('Use a estrela no cabeçalho de uma página para adicioná-la aqui.')
    expect(screen.getByRole('button', { name: 'Favoritos' }).getAttribute('aria-expanded')).toBe('true')
    expect(currentWorkspaceSession.get('user')).toBeUndefined()
  })
  it('never reuses another account list while the next account is loading', async () => {
    const view = mount(<PageFavoritesSection />); await screen.findByRole('link', { name: 'Projeto Equipe' })
    api.actor = { id: 'other' }; api.list.mockReturnValue(new Promise(() => {}))
    await act(async () => view.rerender(view.tree(<PageFavoritesSection />)))
    expect(screen.queryByRole('link', { name: 'Projeto Equipe' })).toBeNull()
    expect(within(screen.getByRole('region', { name: 'Favoritos' })).getByRole('status')).toBeTruthy()
  })
})
