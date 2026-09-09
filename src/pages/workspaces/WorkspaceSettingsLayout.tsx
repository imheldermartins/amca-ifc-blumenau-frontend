import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, Outlet, useParams } from '@tanstack/react-router'
import { cn } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import { defineWorkspaceAbility } from '@/lib/workspaceAbility'
import { workspaceQueryKey } from '@/lib/workspaceQueryKeys'
import { workspaceService } from '@/services/WorkspaceService'
import { WorkspaceSettingsProvider } from './WorkspaceSettingsContext'

export function WorkspaceSettingsLayout() {
  const { lang, workspaceId } = useParams({ strict: false })
  const { user } = useAuth()
  const language = lang ?? 'pt-br'
  const id = typeof workspaceId === 'string' ? workspaceId : ''
  const workspace = useQuery({
    queryKey: workspaceQueryKey(user?.id ?? 'anonymous', id),
    queryFn: () => workspaceService.getWorkspace(id),
    enabled: Boolean(id && user),
  })

  if (workspace.isPending) {
    return <FullScreenMessage message={i18n('pages.workspaces.settings.loading')} />
  }
  if (workspace.isError || !workspace.data) {
    return <FullScreenMessage message={i18n('pages.workspaces.settings.load-error')} error />
  }
  if (!defineWorkspaceAbility(workspace.data.role).can('manage', 'WorkspaceSettings')) {
    return <Navigate to="/$lang/access-denied" params={{ lang: language }} replace />
  }

  const sections = [
    {
      to: '/$lang/workspaces/$workspaceId/settings/general' as const,
      label: i18n('pages.workspaces.settings.general'),
      icon: 'lucide:settings-2',
    },
    {
      to: '/$lang/workspaces/$workspaceId/settings/members' as const,
      label: i18n('pages.workspaces.settings.members'),
      icon: 'lucide:users',
    },
  ]

  return (
    <WorkspaceSettingsProvider workspace={workspace.data}>
      <div className="grid min-h-dvh grid-cols-1 bg-background text-foreground md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="flex flex-col border-b border-divider bg-contrast p-4 md:border-b-0 md:border-r">
          <Link
            to="/$lang/myworkspace/$workspaceId"
            params={{ lang: language, workspaceId: id }}
            className="mb-6 flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-active"
          >
            <Icon icon="lucide:arrow-left" className="size-4" />
            {i18n('pages.workspaces.settings.back')}
          </Link>
          <div className="mb-6 flex items-center gap-3 px-2">
            <span className="flex size-10 items-center justify-center rounded-lg bg-active">
              <Icon icon={workspace.data.icon} className="size-5" />
            </span>
            <Typography variant="subtitle" as="span" className="min-w-0 truncate">
              {workspace.data.name ?? i18n('common.workspace.sem-nome')}
            </Typography>
          </div>
          <nav aria-label={i18n('pages.workspaces.settings.navigation')} className="flex flex-col gap-1">
            {sections.map((section) => (
              <Link
                key={section.to}
                to={section.to}
                params={{ lang: language, workspaceId: id }}
                activeProps={{ className: 'bg-p-purple text-white' }}
                inactiveProps={{ className: 'hover:bg-active' }}
                className={cn('flex items-center gap-2 rounded px-2.5 py-2 text-sm font-medium')}
              >
                <Icon icon={section.icon} className="size-4" />
                {section.label}
              </Link>
            ))}
          </nav>
          <Link
            to="/$lang/workspaces"
            params={{ lang: language }}
            search={{ choose: true, tab: 'workspaces' }}
            className="mt-auto flex items-center gap-2 rounded px-2.5 py-2 text-sm font-medium text-p-red hover:bg-p-red-600/10"
          >
            <Icon icon="lucide:log-out" className="size-4" />
            {i18n('pages.workspaces.settings.exit')}
          </Link>
        </aside>

        <main className="min-w-0 p-5 sm:p-8 lg:p-10">
          <div className="mx-auto max-w-5xl">
            <Typography variant="h1">{i18n('pages.workspaces.settings.title')}</Typography>
            <div className="mt-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </WorkspaceSettingsProvider>
  )
}

function FullScreenMessage({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-foreground">
      <Typography variant="body" as="p" role={error ? 'alert' : undefined} className={error ? 'text-p-red' : undefined}>
        {message}
      </Typography>
    </main>
  )
}
