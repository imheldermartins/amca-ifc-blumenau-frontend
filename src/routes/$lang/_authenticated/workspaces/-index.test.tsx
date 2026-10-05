import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory, createRootRouteWithContext, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  ensureSession: vi.fn(),
  getEntryPage: vi.fn(),
  getBreadcrumb: vi.fn(),
  listMine: vi.fn(),
  listOrganizations: vi.fn(),
  renderSelector: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', name: 'Helder', email: 'helder@example.test' } }) }))
vi.mock('@/services/DatabaseService', () => ({ databaseService: { getEntryPage: dependencies.getEntryPage, getBreadcrumb: dependencies.getBreadcrumb } }))
vi.mock('@/services/WorkspaceService', () => ({ workspaceService: { listMine: dependencies.listMine, listOrganizations: dependencies.listOrganizations } }))

import type { AuthUser } from '@/services/AuthService'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { AppError } from '@/lib/errors'
import { workspacePreference } from '@/lib/workspacePreference'
import { WorkspaceSelectorPage } from '@/pages/workspaces/WorkspaceSelectorPage'
import { Route as AuthenticatedRoute } from '../route'
import { Route as PageRoute } from '../_app/page/$pageId'
import { Route as EntryRoute } from '../workspace/$workspaceId'
import { Route } from './index'

type Auth = { ensureSession: () => Promise<AuthUser | null> }
type AuthGuard = (input: { context: { auth: Auth }; location: { href: string }; params: { lang: string } }) => Promise<{ user: AuthUser }>
type SelectorGuard = (input: { context: { user: AuthUser }; params: { lang: string }; search: { choose: boolean } }) => void
type EntryLoader = (input: { context: { user: AuthUser }; params: { lang: string; workspaceId: string }; preload: boolean }) => Promise<unknown>
type PageGuard = (input: { context: { user: AuthUser }; params: { lang: string; pageId: string }; location: { search: Record<string, unknown> }; preload: boolean }) => Promise<unknown>

// Reutiliza os guards/loaders de produção com o router real. Só a página final
// e as telas vizinhas são simplificadas para observar a transição da listagem.
const authGuard = AuthenticatedRoute.options.beforeLoad as unknown as AuthGuard
const selectorGuard = Route.options.beforeLoad as unknown as SelectorGuard
const entryLoader = EntryRoute.options.loader as unknown as EntryLoader
const pageGuard = PageRoute.options.beforeLoad as unknown as PageGuard
const validateSearch = Route.options.validateSearch as (search: Record<string, unknown>) => { choose: boolean; tab: 'organization' | 'workspaces' }

function mountRouting(initialEntry = '/pt-br/workspaces') {
  const root = createRootRouteWithContext<{ auth: Auth }>()({
    component: Outlet,
    errorComponent: ({ error }) => <p role="alert">{error.message}</p>,
  })
  const lang = createRoute({ getParentRoute: () => root, path: '$lang', beforeLoad: authGuard, component: Outlet })
  const selector = createRoute({
    getParentRoute: () => lang, path: 'workspaces', validateSearch, beforeLoad: selectorGuard,
    component: () => { dependencies.renderSelector(); return <WorkspaceSelectorPage /> },
  })
  const entry = createRoute({ getParentRoute: () => lang, path: 'workspace/$workspaceId', loader: entryLoader })
  const page = createRoute({ getParentRoute: () => lang, path: 'page/$pageId', beforeLoad: pageGuard, component: () => <p>Página inicial carregada</p> })
  const settings = createRoute({ getParentRoute: () => lang, path: 'workspaces/$workspaceId/settings/general', component: () => <p>Configurações da workspace</p> })
  const organizations = createRoute({ getParentRoute: () => lang, path: 'organizations', component: () => <p>Lista de organizações</p> })
  const router = createRouter({
    routeTree: root.addChildren([lang.addChildren([selector, entry, page, settings, organizations])]),
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
    context: { auth: { ensureSession: dependencies.ensureSession } },
  })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider>)
  return router
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  window.localStorage.clear()
  window.sessionStorage.clear()
  dependencies.ensureSession.mockResolvedValue({ id: 'user-1', name: 'Helder', email: 'helder@example.test' })
  dependencies.getEntryPage.mockResolvedValue({ id: 'root-for-current-user', title: 'Página inicial' })
  dependencies.getBreadcrumb.mockResolvedValue([{ id: 'linked-page', parent_id: 'root-for-current-user', depth: 0 }])
  dependencies.listOrganizations.mockResolvedValue([])
  dependencies.listMine.mockResolvedValue([{
    id: 'workspace-a', pageRootId: 'root-for-current-user', name: 'Minha área', isPersonal: true, organizationId: null, data: {}, icon: 'lucide:user',
    owner: { id: 'user-1', name: 'Helder', email: 'helder@example.test' }, permissions: { read: ['view'], write: ['update'] },
  }])
})

afterEach(() => { vi.restoreAllMocks() })

describe('entrada do seletor de workspaces', () => {
  it('aguarda a sessão e a página inicial sem montar ou consultar a listagem', async () => {
    let restoreSession!: (user: AuthUser) => void
    let resolveEntry!: (page: { id: string }) => void
    dependencies.ensureSession.mockReturnValue(new Promise((resolve) => { restoreSession = resolve }))
    dependencies.getEntryPage.mockReturnValue(new Promise((resolve) => { resolveEntry = resolve }))
    workspacePreference.set('user-1', 'workspace-a')
    const router = mountRouting()

    await waitFor(() => expect(dependencies.ensureSession).toHaveBeenCalled())
    expect(dependencies.getEntryPage).not.toHaveBeenCalled()
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
    await act(async () => { restoreSession({ id: 'user-1', name: 'Helder', email: 'helder@example.test' }) })
    await waitFor(() => expect(dependencies.getEntryPage).toHaveBeenCalledWith('workspace-a'))
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
    expect(dependencies.listMine).not.toHaveBeenCalled()
    expect(dependencies.listOrganizations).not.toHaveBeenCalled()

    await act(async () => { resolveEntry({ id: 'root-for-current-user' }) })
    await screen.findByText('Página inicial carregada')
    expect(router.state.location.pathname).toBe('/pt-br/page/root-for-current-user')
    expect(router.state.location.search).toEqual({})
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
    expect(currentWorkspaceSession.get('user-1')).toBe('workspace-a')
    expect(router.history.length).toBe(1)
  })

  it('permite escolher outra workspace e sair para configurações ou organizações', async () => {
    workspacePreference.set('user-1', 'workspace-a')
    const router = mountRouting('/pt-br/workspaces?choose=true')
    await screen.findByRole('heading', { name: 'Minha área' })
    expect(dependencies.getEntryPage).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }))
    await screen.findByText('Configurações da workspace')
    expect(router.state.location.pathname).toBe('/pt-br/workspaces/workspace-a/settings/general')

    await act(async () => { await router.navigate({ to: '/$lang/workspaces', params: { lang: 'pt-br' }, search: { choose: true, tab: 'workspaces' } }) })
    await screen.findByRole('heading', { name: 'Minha área' })
    fireEvent.click(screen.getByRole('button', { name: 'Ir para organizações' }))
    await screen.findByText('Lista de organizações')
    expect(router.state.location.pathname).toBe('/pt-br/organizations')
    expect(dependencies.getEntryPage).not.toHaveBeenCalled()
  })

  it.each([undefined, 'another-user'])('mostra a seleção sem preferência válida para a conta (%s)', async (preferenceUser) => {
    if (preferenceUser) workspacePreference.set(preferenceUser, 'workspace-other-user')
    mountRouting()
    await screen.findByRole('heading', { name: 'Minha área' })
    expect(dependencies.getEntryPage).not.toHaveBeenCalled()
    expect(dependencies.listMine).toHaveBeenCalledTimes(1)
    expect(dependencies.listOrganizations).toHaveBeenCalledTimes(1)
  })

  it.each([403, 404])('limpa uma preferência indisponível (%s) e abre a escolha explícita', async (status) => {
    workspacePreference.set('user-1', 'workspace-a')
    dependencies.getEntryPage.mockRejectedValue(new AppError('api', 'Workspace indisponível', { status }))
    const router = mountRouting()
    await screen.findByRole('heading', { name: 'Minha área' })
    expect(router.state.location.pathname).toBe('/pt-br/workspaces')
    expect(router.state.location.search).toMatchObject({ choose: true })
    expect(workspacePreference.get('user-1')).toBeUndefined()
    expect(dependencies.getEntryPage).toHaveBeenCalledTimes(1)
  })

  it('preserva a preferência quando a API falha sem confirmar perda de acesso', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    workspacePreference.set('user-1', 'workspace-a')
    dependencies.getEntryPage.mockRejectedValue(new AppError('api', 'Sem conexão'))
    mountRouting()
    expect((await screen.findByRole('alert')).textContent).toBe('Sem conexão')
    expect(workspacePreference.get('user-1')).toBe('workspace-a')
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
  })

  it('mantém o erro de um acesso explícito a outra workspace sem apagar a preferência', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    workspacePreference.set('user-1', 'workspace-a')
    dependencies.getEntryPage.mockRejectedValue(new AppError('api', 'Acesso não permitido', { status: 403 }))
    mountRouting('/pt-br/workspace/other-workspace')
    expect((await screen.findByRole('alert')).textContent).toBe('Acesso não permitido')
    expect(workspacePreference.get('user-1')).toBe('workspace-a')
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
  })

  it('preserva deep-links de páginas mesmo quando existe uma preferência', async () => {
    workspacePreference.set('user-1', 'workspace-a')
    const router = mountRouting('/pt-br/page/linked-page')
    await screen.findByText('Página inicial carregada')
    expect(router.state.location.pathname).toBe('/pt-br/page/linked-page')
    expect(dependencies.getEntryPage).not.toHaveBeenCalled()
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
  })

  it('antecipa a página pelo preload sem navegar, montar a lista ou trocar a sessão', async () => {
    workspacePreference.set('user-1', 'workspace-a')
    currentWorkspaceSession.set('user-1', 'workspace-current')
    const router = mountRouting('/pt-br/organizations')
    await screen.findByText('Lista de organizações')
    await act(async () => { await router.preloadRoute({ to: '/$lang/workspaces', params: { lang: 'pt-br' }, search: { choose: false, tab: 'workspaces' } }) })
    expect(dependencies.getEntryPage).toHaveBeenCalledWith('workspace-a')
    expect(dependencies.getBreadcrumb).toHaveBeenCalledWith('root-for-current-user')
    expect(currentWorkspaceSession.get('user-1')).toBe('workspace-current')
    expect(router.state.location.pathname).toBe('/pt-br/organizations')
    expect(dependencies.renderSelector).not.toHaveBeenCalled()

    await act(async () => { await router.navigate({ to: '/$lang/workspaces', params: { lang: 'pt-br' }, search: { choose: false, tab: 'workspaces' } }) })
    await screen.findByText('Página inicial carregada')
    expect(currentWorkspaceSession.get('user-1')).toBe('workspace-a')
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
  })

  it('limpa uma preferência sem acesso na navegação, preservando-a durante o preload', async () => {
    workspacePreference.set('user-1', 'workspace-a')
    dependencies.getEntryPage.mockRejectedValue(new AppError('api', 'Acesso não permitido', { status: 403 }))
    const router = mountRouting('/pt-br/organizations')
    await screen.findByText('Lista de organizações')
    await act(async () => { await router.preloadRoute({ to: '/$lang/workspaces', params: { lang: 'pt-br' }, search: { choose: false, tab: 'workspaces' } }) })
    expect(workspacePreference.get('user-1')).toBe('workspace-a')
    expect(dependencies.renderSelector).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/pt-br/organizations')

    await act(async () => { await router.navigate({ to: '/$lang/workspaces', params: { lang: 'pt-br' }, search: { choose: false, tab: 'workspaces' } }) })
    await screen.findByRole('heading', { name: 'Minha área' })
    expect(workspacePreference.get('user-1')).toBeUndefined()
    expect(router.state.location.search).toMatchObject({ choose: true })
  })
})
