import {
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button, Popover, Switch, cn } from 'cubs-components'

import {
  GlobalSettingsModal,
  type GlobalSettingsFragment,
} from '@components/GlobalSettingsModal'
import { SignOutConfirmationModal } from '@components/SignOutConfirmationModal'
import { Typography } from '@components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useDialog } from '@/hooks/useDialog'
import { useLocalStorageState } from '@/hooks/useClientStorage'
import { useTheme } from '@/hooks/useTheme'
import { DEFAULT_LANGUAGE, i18n } from '@/lib/i18n'
import Topbar from './-components/Topbar'

export function AppLayout() {
  const { lang } = useParams({ strict: false })
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, _] = useLocalStorageState('sidebarCollapsed', false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [settingsFragment, setSettingsFragment] =
    useState<GlobalSettingsFragment>('#profile')
  const { theme, toggleTheme } = useTheme()
  const auth = useAuth()
  const workspaceState = useWorkspace()
  const globalSettingsDialog = useDialog()
  const signOutDialog = useDialog()

  const currentLang = lang ?? DEFAULT_LANGUAGE.slug
  const currentWorkspaceId = workspaceState.workspaceId
  const userLabel = auth.user?.name ?? auth.user?.email ?? i18n('pages.app.account-menu.user')

  function openGlobalSettings(fragment: GlobalSettingsFragment) {
    setAccountMenuOpen(false)
    setSettingsFragment(fragment)
    globalSettingsDialog.openDialog()
  }

  function openSignOutConfirmation() {
    setAccountMenuOpen(false)
    signOutDialog.openDialog()
  }

  async function handleSignOut() {
    signOutDialog.closeDialog()
    await auth.signOut()
  }

  function navigateSidebar(target: 'home' | 'collaborating' | 'chat' | 'schedule') {
    if (!currentWorkspaceId) return
    const params = { lang: currentLang, workspaceId: currentWorkspaceId }
    if (target === 'home') {
      void navigate({ to: '/$lang/myworkspace/$workspaceId', params, replace: true })
    } else if (target === 'collaborating') {
      void navigate({
        to: '/$lang/colaborando',
        params: { lang: currentLang },
        search: { workspace: currentWorkspaceId },
        replace: true,
      })
    } else if (target === 'chat') {
      void navigate({ to: '/$lang/myworkspace/$workspaceId/mychat', params, replace: true })
    } else {
      void navigate({ to: '/$lang/myworkspace/$workspaceId/schedule', params, replace: true })
    }
  }

  const workspacePath = currentWorkspaceId
    ? `/${currentLang}/myworkspace/${currentWorkspaceId}`
    : null;
  const navItems = [
    {
      target: 'home' as const,
      name: i18n('common.navigation.home'),
      active: location.pathname === workspacePath,
      icon: 'cuida:home-outline',
    },
    {
      target: 'collaborating' as const,
      name: i18n('common.navigation.colaborando'),
      active: location.pathname === `/${currentLang}/colaborando`,
      icon: 'cuida:users-outline',
    },
    {
      target: 'chat' as const,
      name: i18n('common.navigation.chat'),
      active: workspacePath !== null && location.pathname === `${workspacePath}/mychat`,
      icon: 'cuida:chatbubble-outline',
    },
    {
      target: 'schedule' as const,
      name: i18n('common.navigation.agenda'),
      active: workspacePath !== null && location.pathname === `${workspacePath}/schedule`,
      icon: 'cuida:calendar-clear-outline',
    },
  ];

  return (
    <div className='flex h-dvh flex-col overflow-hidden bg-background'>
      <Topbar />

      <div className='flex flex-1 min-h-0'>
        <section
          className={cn(
            'm-3 rounded-2xl border border-divider-contrast bg-background p-2 shadow-2xl shadow-dark-900/15 backdrop-blur-xl',
            'flex flex-col justify-between shrink-0 overflow-hidden',
            'transition-[width] duration-300 ease-in-out',
            collapsed ? 'w-14 items-center' : 'w-48 items-start',
          )}
        >
          <div className={cn('flex-1', collapsed ? 'w-9 transition-[width] delay-300 duration-150' : 'w-full')}>
            <nav>
              <ul className={cn('flex flex-col gap-1')}>
                {navItems.map((item, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      disabled={!currentWorkspaceId}
                      onClick={() => navigateSidebar(item.target)}
                      className={cn(
                        collapsed ? 'w-9' : 'w-full',
                        'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                        item.active
                          ? 'bg-p-purple text-light-100'
                          : 'glow-purple-hover hover:bg-active',
                        !currentWorkspaceId && 'cursor-not-allowed opacity-45',
                      )}
                    >
                      <Icon icon={item.icon} fontSize={20} className={cn('shrink-0')} />
                      <Typography variant="body" as="span" className={cn('whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}>
                        {item.name}
                      </Typography>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className={cn('w-full flex flex-col gap-2')}>
            <Popover
              open={accountMenuOpen}
              onOpenChange={setAccountMenuOpen}
              side="right"
              align="end"
              sideOffset={8}
              trigger={
                <Button
                  variant="text"
                  color="from-theme"
                  className={cn(
                    collapsed ? 'w-9' : 'w-full',
                    'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                  )}
                  aria-label={i18n('pages.app.account-menu.open')}
                >
                  <Icon icon="lucide:circle-user-round" fontSize={20} className="shrink-0" />
                  <Typography
                    variant="body"
                    as="span"
                    className={cn('whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}
                  >
                    {userLabel}
                  </Typography>
                </Button>
              }
            >
              {/**
               * Adicionar isso a um contexto de opções por objetos em shared.ts
              */}
              <div role="menu" className="flex flex-col">
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  label={i18n('common.modo-escuro')}
                  className="glow-purple-hover w-full flex-row-reverse justify-between rounded px-2 py-1 transition-[color,background-color,box-shadow] hover:bg-active focus-within:bg-active"
                />
                <hr className="border-divider-contrast my-1" />
                <button
                  type="button"
                  role="menuitem"
                  className="glow-purple-hover flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-[color,background-color,box-shadow] hover:bg-active focus-visible:bg-active focus-visible:outline-none"
                  onClick={() => openGlobalSettings('#profile')}
                >
                  <Icon icon="lucide:user-round" fontSize={16} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{userLabel}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="glow-purple-hover flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm transition-[color,background-color,box-shadow] hover:bg-active focus-visible:bg-active focus-visible:outline-none"
                  onClick={() => openGlobalSettings('#settings')}
                >
                  <Icon icon="lucide:settings" fontSize={16} className="shrink-0" />
                  <span>{i18n('pages.app.account-menu.settings')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  className="flex w-full cursor-not-allowed items-center gap-2 rounded px-2 py-1 text-left text-sm opacity-50"
                >
                  <Icon icon="lucide:bell" fontSize={16} className="shrink-0" />
                  <span>{i18n('pages.app.account-menu.notifications')}</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-p-red transition-colors hover:bg-p-red-600/20 focus-visible:bg-p-red-600/20 focus-visible:outline-none"
                  onClick={openSignOutConfirmation}
                >
                  <Icon icon="lucide:log-out" fontSize={16} className="shrink-0" />
                  <span>{i18n('pages.app.account-menu.logout')}</span>
                </button>
              </div>
            </Popover>
          </div>
        </section>

        <main className='flex-1 min-h-0 overflow-y-auto'>
          <Outlet />
        </main>
      </div>

      <GlobalSettingsModal
        {...globalSettingsDialog.dialogProps}
        fragment={settingsFragment}
        onFragmentChange={setSettingsFragment}
      />

      <SignOutConfirmationModal
        {...signOutDialog.dialogProps}
        onConfirm={handleSignOut}
      />
    </div>
  )
}
