import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: '/pt-br/myworkspace/01KXVZ00000000000000000001/mychat',
  workspaceId: '01KXVZ00000000000000000001' as string | null,
}))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => null,
  useLocation: () => ({ pathname: mocks.pathname }),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ lang: 'pt-br' }),
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user', name: 'Pessoa' }, signOut: vi.fn() }) }))
vi.mock('@/contexts/WorkspaceContext', () => ({ useWorkspace: () => ({
  workspaceId: mocks.workspaceId,
  workspace: mocks.workspaceId ? { id: mocks.workspaceId, name: 'Minha área', icon: 'lucide:boxes' } : null,
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
vi.mock('@components/SearchBar', () => ({ SearchBar: () => null }))
vi.mock('@iconify/react', () => ({ Icon: () => null }))
vi.mock('cubs-components', async (original) => ({
  ...await original<typeof import('cubs-components')>(),
  Popover: () => null,
}))

import { AppLayout } from './AppLayout'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pathname = '/pt-br/myworkspace/01KXVZ00000000000000000001/mychat'
  mocks.workspaceId = '01KXVZ00000000000000000001'
})

describe('AppLayout sidebar', () => {
  it('usa rotas absolutas e replace em cliques repetidos', () => {
    render(<AppLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.agenda' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.navigation.agenda' }))
    expect(mocks.navigate.mock.calls.map(([options]) => options.to)).toEqual([
      '/$lang/myworkspace/$workspaceId/schedule',
      '/$lang/myworkspace/$workspaceId/mychat',
      '/$lang/myworkspace/$workspaceId/schedule',
    ])
    expect(mocks.navigate.mock.calls.every(([options]) => options.replace === true)).toBe(true)
    expect(mocks.navigate.mock.calls.every(([options]) => options.params.workspaceId === mocks.workspaceId)).toBe(true)
  })

  it('desabilita a navegação quando a rota não identifica uma workspace', () => {
    mocks.workspaceId = null
    render(<AppLayout />)
    expect((screen.getByRole('button', { name: 'common.navigation.agenda' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
