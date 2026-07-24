import { Link, Outlet, useLocation, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { Button, Switch, cn } from 'cubs-components'

import { Modal } from '@components/Modal'
import { SearchBar } from '@components/SearchBar'
import { Typography } from '@components/Typography'
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
  const { theme, toggleTheme } = useTheme()
  const workspaceState = useWorkspace()
  const workspaceDialog = useDialog()

  // A workspace é parte do caminho, então o link dela carrega o id. Fora da
  // rota de workspace (ex.: uma página compartilhada) o id não está na URL —
  // aí o destino é a workspace PADRÃO, a mesma dos redirects de login.
  const currentLang = lang ?? DEFAULT_LANGUAGE.slug
  const workspaceHref = `/${currentLang}/myworkspace/${workspaceId ?? DEFAULT_WORKSPACE_ID}`

  const navItems = [
    { name: i18n('common.navigation.home'), href: workspaceHref, icon: 'lucide:workflow' },
    {
      name: i18n('common.navigation.colaborando'),
      href: `/${currentLang}/colaborando`,
      icon: 'lucide:users',
    },
    { name: i18n('common.navigation.chat'), href: `${workspaceHref}/mychat`, icon: 'lucide:message-circle' },
    { name: i18n('common.navigation.agenda'), href: `${workspaceHref}/schedule`, icon: 'lucide:calendar' },
  ]

  return (
    // <div className="flex min-h-dvh flex-col">
    //   <header className="flex items-center justify-between border-b border-divider bg-contrast px-6 py-3">
    //     <Typography variant="h3" as="span">
    //       {i18n('common.app-name')}
    //     </Typography>
    //     <div className="flex items-center gap-4">
    //       <Typography variant="subtitle" as="span">
    //         {auth.user?.name ?? auth.user?.email}
    //       </Typography>
    //       <ThemeToggle />
    //       <Button variant="outlined" color="red" onClick={handleSignOut}>
    //         {i18n('common.sair')}
    //       </Button>
    //     </div>
    //   </header>

    //   <main className="flex-1">
    //     <Outlet />
    //   </main>
    // </div>
    <div className='flex h-dvh flex-col overflow-hidden'>

      <header className='flex items-center justify-between border-b border-divider px-6 py-2 shrink-0'>
        <Button
          variant='text'
          color='from-theme'
          className='p-0.5'
          onClick={() => setCollapsed((value) => !value)}
          aria-label={i18n(collapsed ? 'common.expandir-menu' : 'common.recolher-menu')}
        >
          <Icon
            icon={collapsed ? 'lucide:sidebar-open' : 'lucide:sidebar-close'}
            fontSize={20}
            className={THEME.textMuted}
          />
        </Button>
        {/* Busca do app: o estado dela é a URL (`?q=`), não um state daqui —
            quem consome lê `useQueryParams().get('q')` de onde estiver. */}
        <div className='flex flex-1 justify-center px-6'>
          <SearchBar className='w-full max-w-sm' />
        </div>

        <Button
          variant='text'
          color='from-theme'
          className='px-2 py-1'
          onClick={workspaceDialog.openDialog}
          aria-label={i18n('common.workspace.abrir-detalhes')}
        >
          <Icon icon='lucide:graduation-cap' className={THEME.textMuted} />
          <Typography variant="subtitle" as='span' className='whitespace-nowrap text-nowrap'>
            {workspaceLabel(workspaceState)}
          </Typography>
        </Button>
      </header>

      <div className='flex flex-1 min-h-0'>
        <section
          className={cn(
            'bg-contrast border border-divider-contrast px-2 py-3 m-4 rounded-lg shadow-xl',
            'flex flex-col justify-between shrink-0 overflow-hidden',
            'transition-[width] duration-300 ease-in-out',
            collapsed ? 'w-16 items-center' : 'w-48 items-start',
          )}
        >
          <div className='w-full'>
            <nav>
              <ul className={cn('flex flex-col gap-2')}>
                {navItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      to={item.href}
                      className={cn(
                        'w-full inline-flex items-center gap-2 px-3 py-1.5 rounded transition-all ease-in duration-200',
                        location.pathname === item.href
                          ? 'bg-p-purple-500 text-white shadow-xl shadow-p-purple-600/40 dark:shadow-p-purple-500/40 hover:bg-p-purple-400 dark:hover:bg-p-purple-600'
                          : 'hover:bg-active',
                      )}
                    >
                      <Icon icon={item.icon} fontSize={18} className={cn('shrink-0', collapsed && 'transition-discrete ml-0.5')} />
                      <Typography variant="body" as="span" className={cn('whitespace-nowrap', collapsed && 'hidden')}>
                        {item.name}
                      </Typography>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <Switch
            checked={theme === 'dark'}
            onCheckedChange={() => toggleTheme()}
            label={collapsed ? undefined : i18n('common.modo-escuro')}
          />
        </section>

        <main className='flex-1 min-h-0 overflow-y-auto'>
          <Outlet />
        </main>
      </div>

      {/* TEMPORÁRIO: enquanto o seletor de workspaces não existe, a modal só
          mostra o contexto cru — serve de prova de que o fetch do layout chegou
          e é o lugar onde a interface de escolha vai nascer. */}
      <Modal
        {...workspaceDialog.dialogProps}
        size='lg'
        accessibleTitle={i18n('common.workspace.detalhes')}
      >
        <Typography variant='caption' as='p' className='mb-2'>
          {i18n('common.workspace.debug-contexto')}
        </Typography>
        <pre className='overflow-auto rounded bg-background p-3 text-xs'>
          {JSON.stringify(workspaceState, null, 2)}
        </pre>
      </Modal>
    </div>
  )
}
