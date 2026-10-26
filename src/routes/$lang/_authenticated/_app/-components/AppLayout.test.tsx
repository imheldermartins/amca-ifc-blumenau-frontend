import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  canGoBack: false,
  pathname: '/pt-br/my-chat',
  workspaceId: '01KXVZ00000000000000000001' as string | null,
  mobile: false,
  writable: false,
  collapsed: false,
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  useLocation: () => ({ pathname: mocks.pathname }),
  useCanGoBack: () => mocks.canGoBack,
  useNavigate: () => mocks.navigate,
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', name: 'Pessoa' }, signOut: vi.fn() }) }))
vi.mock('@/contexts/WorkspaceContext', () => ({ useWorkspace: () => ({
  workspaceId: mocks.workspaceId,
  workspace: mocks.workspaceId ? {
    id: mocks.workspaceId, name: 'Minha área', icon: 'lucide:boxes', pageRootId: 'page-root',
    permissions: { read: ['view'], write: mocks.writable ? ['update'] : [] },
  } : null,
  loading: false,
  failed: false,
}) }))
vi.mock('@/hooks/useClientStorage', () => ({ useLocalStorageState: () => [mocks.collapsed, vi.fn()] }))
vi.mock('@/shared/cubs-components/lib/useMediaQuery', () => ({ useMediaQuery: () => mocks.mobile }))
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }))
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ unreadCount: 0 }) }))
vi.mock('@/hooks/useModal', () => ({ useModal: () => ({ openModal: vi.fn() }) }))
vi.mock('@/lib/i18n', () => ({ DEFAULT_LANGUAGE: { slug: 'pt-br' }, i18n: (key: string) => key }))
vi.mock('@components/GlobalSettingsModal', () => ({ GlobalSettingsContent: () => null }))
vi.mock('@components/SignOutConfirmationModal', () => ({ SignOutConfirmationContent: () => null }))
vi.mock('@components/SearchBar', () => ({
  SearchBar: ({ className }: { className?: string }) => <div role='search' className={className} />,
}))
vi.mock('@iconify/react', () => ({ Icon: () => null }))

import { AppLayout } from './AppLayout'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pathname = '/pt-br/my-chat'
  mocks.workspaceId = '01KXVZ00000000000000000001'
  mocks.canGoBack = false
  mocks.mobile = false
  mocks.writable = false
  mocks.collapsed = false
})

describe('AppLayout sidebar', () => {
  it('usa rotas absolutas e replace em cliques repetidos', () => {
    const view = render(<AppLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.agenda' }))
    mocks.pathname = '/pt-br/schedule'
    view.rerender(<AppLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.chat' }))
    mocks.pathname = '/pt-br/my-chat'
    view.rerender(<AppLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.agenda' }))
    expect(mocks.navigate.mock.calls.map(([options]) => options.to)).toEqual([
      '/$lang/schedule',
      '/$lang/my-chat',
      '/$lang/schedule',
    ])
    expect(mocks.navigate.mock.calls.every(([options]) => options.replace === true)).toBe(true)
    expect(mocks.navigate.mock.calls.every(([options]) => options.params.lang === 'pt-br')).toBe(true)
    expect(mocks.navigate.mock.calls.every(([options]) =>
      Object.keys(options.search).length === 0,
    )).toBe(true)
  })

  it('desabilita a navegação quando a rota não identifica uma workspace', () => {
    mocks.workspaceId = null
    render(<AppLayout />)
    expect((screen.getByRole('button', { name: 'common.navigation.agenda' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('mantém a busca no centro e desabilita voltar quando não existe histórico', () => {
    render(<AppLayout />)

    const search = screen.getByRole('search')
    const searchSlot = search.parentElement
    const header = search.closest('header')
    const backButton = screen.getByRole('button', { name: 'common.navigation.back' })

    expect(header?.className).toContain('grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)_minmax(0,1fr)]')
    expect(searchSlot?.className).toContain('relative w-full justify-self-center')
    expect(backButton.parentElement?.className).toContain('right-full')
    expect(backButton.className).toContain('text-foreground/60')
    expect(backButton.className).toContain('disabled:text-foreground/25')
    expect((backButton as HTMLButtonElement).disabled).toBe(true)
  })

  it('mantém o menu mobile completamente fechado e sem topbar até abrir a drawer', () => {
    mocks.mobile = true
    render(<AppLayout />)

    expect(screen.queryByRole('banner')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'common.navigation.agenda' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'common.expandir-menu' }))
    const drawer = screen.getByRole('dialog')
    expect(within(drawer).getByRole('button', { name: 'common.navigation.agenda' })).toBeTruthy()
    expect(within(drawer).getByRole('button', { name: 'common.workspace.abrir-detalhes' })).toBeTruthy()
  })

  it('fecha a drawer depois de navegar e ao escolher a página atual', () => {
    mocks.mobile = true
    render(<AppLayout />)

    fireEvent.click(screen.getByRole('button', { name: 'common.expandir-menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.agenda' }))
    expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/$lang/schedule' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'common.expandir-menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.chat' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.navigate).toHaveBeenCalledTimes(1)
  })

  it.each([false, true])('reutiliza a navegação de workspace e fecha a drawer (edição: %s)', (writable) => {
    mocks.mobile = true
    mocks.writable = writable
    render(<AppLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'common.expandir-menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.workspace.abrir-detalhes' }))

    expect(mocks.navigate).toHaveBeenCalledWith(expect.objectContaining({
      to: writable ? '/$lang/workspaces/$workspaceId/settings/general' : '/$lang/page/$pageId',
    }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('fecha com Escape e devolve o foco ao botão de abrir', async () => {
    mocks.mobile = true
    render(<AppLayout />)
    const trigger = screen.getByRole('button', { name: 'common.expandir-menu' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('fecha em mudanças externas de rota e preserva o estado desktop ao redimensionar', () => {
    mocks.mobile = true
    mocks.collapsed = true
    const view = render(<AppLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'common.expandir-menu' }))
    mocks.pathname = '/pt-br/schedule'
    view.rerender(<AppLayout />)
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'common.expandir-menu' }))
    mocks.mobile = false
    view.rerender(<AppLayout />)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('banner')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'common.navigation.agenda' }).closest('aside')?.className).toContain('w-14')

    mocks.mobile = true
    view.rerender(<AppLayout />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('volta pelo histórico real do navegador quando existe uma entrada anterior', () => {
    mocks.canGoBack = true
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    render(<AppLayout />)

    const backButton = screen.getByRole('button', { name: 'common.navigation.back' })
    expect((backButton as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(backButton)
    expect(back).toHaveBeenCalledTimes(1)
  })
})
