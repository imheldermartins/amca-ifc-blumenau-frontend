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
    <div className='flex h-dvh flex-col overflow-hidden bg-background'>
      <header className='z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)_minmax(0,1fr)] items-center bg-background px-4 py-1.5'>
        <div className='min-w-0 justify-self-start'>
          <Button
            variant='text'
            color='from-theme'
            className='p-1'
            onClick={() => setCollapsed((value) => !value)}
            aria-label={i18n(collapsed ? 'common.expandir-menu' : 'common.recolher-menu')}
          >
            <Icon
              icon={collapsed ? 'lucide:sidebar-open' : 'lucide:sidebar-close'}
              fontSize={20}
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
            onClick={workspaceDialog.openDialog}
            aria-label={i18n('common.workspace.abrir-detalhes')}
          >
            <Icon icon='lucide:graduation-cap' className={THEME.textMuted} />
            <Typography variant="subtitle" as='span' className='truncate'>
              {workspaceLabel(workspaceState)}
            </Typography>
          </Button>
        </div>
      </header>

      <div className='flex flex-1 min-h-0'>
        <section
          className={cn(
            'm-3 rounded-2xl border border-divider-contrast bg-background p-2 shadow-2xl shadow-black/15 backdrop-blur-xl',
            'flex flex-col justify-between shrink-0 overflow-hidden',
            'transition-[width] duration-300 ease-in-out',
            collapsed ? 'w-14 items-center' : 'w-48 items-start',
          )}
        >
          <div className='w-full'>
            <nav>
              <ul className={cn('flex flex-col gap-1')}>
                {navItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      to={item.href}
                      className={cn(
                        'w-full inline-flex items-center gap-2 px-2.5 py-1.5 rounded transition-all ease-in duration-200',
                        location.pathname === item.href
                          ? 'bg-p-purple text-white'
                          : 'glow-purple-hover hover:bg-active',
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
        <pre className='overflow-auto p-0 text-xs'>
          {JSON.stringify(workspaceState, null, 2)}
        </pre>
      </Modal>
    </div>
  )
}
