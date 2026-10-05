import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from '@tanstack/react-router'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { i18n } from '@/lib/i18n'
import { defineWorkspaceAbility, type WorkspaceSubject } from '@/lib/workspaceAbility'
import { workspaceQueryKey } from '@/lib/workspaceQueryKeys'
import { workspaceService } from '@/services/WorkspaceService'
import { WorkspaceSettingsProvider } from './WorkspaceSettingsContext'
import { WorkspaceSettingsHeader } from './WorkspaceSettingsHeader'
import { WorkspaceSettingsSidebar } from './WorkspaceSettingsSidebar'

const sectionLabels: Record<string, string> = { general: 'general', members: 'members', permissions: 'permissions' }
const subjects: WorkspaceSubject[] = ['WorkspaceSettings', 'WorkspaceMembers', 'WorkspacePermissions']

export function WorkspaceSettingsLayout({ workspaceId }: { workspaceId: string }) {
  const { slug: lang } = useLanguage()
  const { user } = useAuth()
  const section = useLocation({ select: (location) => sectionLabels[location.pathname.split('/').at(-1) ?? ''] ?? 'general' })
  const workspace = useQuery({
    queryKey: workspaceQueryKey(user?.id ?? 'anonymous', workspaceId),
    queryFn: () => workspaceService.getWorkspace(workspaceId), enabled: Boolean(workspaceId && user),
  })
  if (workspace.isPending) return <FullScreenMessage message={i18n('pages.workspaces.settings.loading')} />
  if (workspace.isError || !workspace.data) return <FullScreenMessage message={i18n('pages.workspaces.settings.load-error')} error />
  const ability = defineWorkspaceAbility(workspace.data)
  if (!subjects.some((subject) => ability.can('manage', subject))) return <Navigate to="/$lang/access-denied" params={{ lang }} replace />

  return <WorkspaceSettingsProvider workspace={workspace.data}>
    <div className="grid min-h-dvh grid-cols-1 bg-background text-foreground md:grid-cols-[18rem_minmax(0,1fr)]">
      <WorkspaceSettingsSidebar />
      <main className="min-w-0 p-5 sm:p-8 lg:p-10"><div className="mx-auto w-full max-w-5xl">
        <WorkspaceSettingsHeader key={workspaceId} section={i18n('pages.workspaces.settings.' + section)} />
        <Outlet />
      </div></main>
    </div>
  </WorkspaceSettingsProvider>
}

function FullScreenMessage({ message, error = false }: { message: string; error?: boolean }) {
  return <main className="flex min-h-dvh items-center justify-center bg-background p-5 text-foreground"><Typography variant="body" as="p" role={error ? 'alert' : undefined} className={error ? 'text-p-red' : undefined}>{message}</Typography></main>
}
