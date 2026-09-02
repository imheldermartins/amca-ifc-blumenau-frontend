import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button, Popover, Switch, cn } from 'cubs-components'

import {
  GlobalSettingsModal,
  type GlobalSettingsFragment,
} from '@components/GlobalSettingsModal'
import { SearchBar } from '@components/SearchBar'
import { SignOutConfirmationModal } from '@components/SignOutConfirmationModal'
import { Typography } from '@components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import {
  DEFAULT_WORKSPACE_ID,
  useWorkspace,
  type WorkspaceState,
} from '@/contexts/WorkspaceContext'
import { useDialog } from '@/hooks/useDialog'
import { useLocalStorageState } from '@/hooks/useClientStorage'
import { useTheme } from '@/hooks/useTheme'
import { DEFAULT_LANGUAGE, i18n } from '@/lib/i18n'
import { THEME } from '@/lib/theme'

/**
 * Rótulo da workspace na barra superior. Os três estados são distintos de
 * propósito: workspace que carregou SEM nome (`name` é anulável no backend) não
 * é a mesma coisa que workspace que não carregou.
 */
function workspaceLabel({ workspace, loading, failed }: WorkspaceState): string {
  if (loading) return i18n('common.carregando')
  if (failed) return i18n('common.workspace.indisponivel')
  return workspace?.name ?? i18n('common.workspace.sem-nome')
}

export function AppLayout() {
  // `strict: false`: o layout serve TODA a área privada, e o `workspaceId` só
  // existe na rota de workspace (em `/page/:id` e "Colaborando" não há).
  const { lang, workspaceId } = useParams({ strict: false })
  const location = useLocation()
  // Persistida: recolher a sidebar é preferência, e o usuário espera que ela
  // continue recolhida no próximo acesso. Antes era `useState(false)`, que
  // esquecia a cada navegação/reload.
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [settingsFragment, setSettingsFragment] =
    useState<GlobalSettingsFragment>('#profile')
  const { theme, toggleTheme } = useTheme()
  const auth = useAuth()
  const workspaceState = useWorkspace()
  const globalSettingsDialog = useDialog()
  const signOutDialog = useDialog()

  // A workspace é parte do caminho, então o link dela carrega o id. Fora da
  // rota de workspace (ex.: uma página compartilhada) o id não está na URL —
  // aí o destino é a workspace PADRÃO, a mesma dos redirects de login.
  const currentLang = lang ?? DEFAULT_LANGUAGE.slug
  const workspaceHref = `/${currentLang}/myworkspace/${workspaceId ?? DEFAULT_WORKSPACE_ID}`
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

  const navItems = [
    { name: i18n('common.navigation.home'), href: workspaceHref, icon: 'lucide:grip' },
    {
      name: i18n('common.navigation.colaborando'),
      href: `/${currentLang}/colaborando`,
      icon: 'lucide:users',
    },
    { name: i18n('common.navigation.chat'), href: `${workspaceHref}/mychat`, icon: 'cuida:chatbubble-outline' },
    { name: i18n('common.navigation.agenda'), href: `${workspaceHref}/schedule`, icon: 'cuida:calendar-clear-outline' },
  ]

  return (
    <div className='flex h-dvh flex-col overflow-hidden bg-background'>
      <header className='z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)_minmax(0,1fr)] items-center py-1 px-6 bg-background'>
        <div className='min-w-0 justify-self-start'>
          <Button
            variant='text'
            color='from-theme'
            className='p-1 hover:bg-transparent'
            onClick={() => setCollapsed((value) => !value)}
            aria-label={i18n(collapsed ? 'common.expandir-menu' : 'common.recolher-menu')}
          >
            <Icon
              icon={!collapsed ? 'cuida:sidebar-expand-outline' : 'cuida:sidebar-collapse-outline'}
              fontSize={24}
              className={THEME.textMuted}
            />
          </Button>
        </div>
        <SearchBar className='w-full' />

        <div className='min-w-0 max-w-full justify-self-end'>
          <Button
            variant='text'
            color='from-theme'
            className='min-w-0 max-w-full px-2 py-1 hover:bg-active/50'
            onClick={() => openGlobalSettings('#workspace')}
            aria-label={i18n('common.workspace.abrir-detalhes')}
          >
            <Icon icon='lucide:graduation-cap' fontSize={20} className={THEME.textMuted} />
            <Typography variant="subtitle" as='span' className='truncate ml-0.5'>
              {workspaceLabel(workspaceState)}
            </Typography>
          </Button>
        </div>
      </header>

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
                    <Link
                      to={item.href}
                      className={cn(
                        collapsed ? 'w-9' : 'w-full',
                        'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                        location.pathname === item.href
                          ? 'bg-p-purple text-light-100'
                          : 'glow-purple-hover hover:bg-active',
                      )}
                    >
                      <Icon icon={item.icon} fontSize={20} className={cn('shrink-0')} />
                      <Typography variant="body" as="span" className={cn('whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}>
                        {item.name}
                      </Typography>
                    </Link>
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
        workspaceState={workspaceState}
      />

      <SignOutConfirmationModal
        {...signOutDialog.dialogProps}
        onConfirm={handleSignOut}
      />
    </div>
  )
}
