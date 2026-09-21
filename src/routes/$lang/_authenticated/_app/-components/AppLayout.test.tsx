import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  canGoBack: false,
  pathname: '/pt-br/my-chat',
  workspaceId: '01KXVZ00000000000000000001' as string | null,
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
  workspace: mocks.workspaceId ? { id: mocks.workspaceId, name: 'Minha área', icon: 'lucide:boxes', pageRootId: 'page-root' } : null,
  loading: false,
  failed: false,
}) }))
vi.mock('@/hooks/useClientStorage', () => ({ useLocalStorageState: () => [false, vi.fn()] }))
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }))
vi.mock('@/hooks/useDialog', () => ({ useDialog: () => ({
  dialogProps: { open: false, onOpenChange: vi.fn() }, openDialog: vi.fn(), closeDialog: vi.fn(),
}) }))
vi.mock('@/lib/i18n', () => ({ DEFAULT_LANGUAGE: { slug: 'pt-br' }, i18n: (key: string) => key }))
vi.mock('@components/GlobalSettingsModal', () => ({ GlobalSettingsModal: () => null }))
vi.mock('@components/SignOutConfirmationModal', () => ({ SignOutConfirmationModal: () => null }))
vi.mock('@components/SearchBar', () => ({
  SearchBar: ({ className }: { className?: string }) => <div role='search' className={className} />,
}))
vi.mock('@iconify/react', () => ({ Icon: () => null }))
vi.mock('cubs-components', async (original) => ({
  ...await original<typeof import('cubs-components')>(),
  Popover: () => null,
}))

import { AppLayout } from './AppLayout'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pathname = '/pt-br/my-chat'
  mocks.workspaceId = '01KXVZ00000000000000000001'
  mocks.canGoBack = false
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
    expect(backButton.className).toContain('absolute right-full')
    expect(backButton.className).toContain('text-foreground/60')
    expect(backButton.className).toContain('disabled:text-foreground/25')
    expect((backButton as HTMLButtonElement).disabled).toBe(true)
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
