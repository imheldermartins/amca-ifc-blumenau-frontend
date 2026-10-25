import { useQuery } from '@tanstack/react-query'
import { Outlet, useLocation } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { MentionScopeProvider } from '@/contexts/MentionContext'
import { OrganizationSettingsProvider } from '@/hooks/useOrganizationSettings'
import { workspaceService } from '@/services/WorkspaceService'
import { i18n } from '@/lib/i18n'
import { OrganizationSettingsHeader } from './OrganizationSettingsHeader'
import { OrganizationSettingsSidebar } from './OrganizationSettingsSidebar'

export function OrganizationSettingsLayout({ organizationId }: { organizationId: string }) {
  const { user } = useAuth()
  const section = useLocation({ select: (location) => location.pathname.split('/').at(-1) ?? 'workspaces' })
  const organization = useQuery({ queryKey: ['organization', user?.id, organizationId], queryFn: () => workspaceService.getOrganization(organizationId), enabled: Boolean(user) })
  if (organization.isPending) return <main className="grid min-h-dvh place-items-center bg-background text-foreground" aria-busy="true">{i18n('common.carregando')}</main>
  if (organization.isError || !organization.data) return <main className="grid min-h-dvh place-items-center bg-background text-foreground"><p role="alert">{i18n('organization.settings.load-error')}</p></main>
  return <OrganizationSettingsProvider value={organization.data}>
    <MentionScopeProvider scope={{ organizationId }}>
      <div className="grid min-h-dvh grid-cols-1 bg-background text-foreground md:grid-cols-[18rem_minmax(0,1fr)]">
        <OrganizationSettingsSidebar />
        <main className="min-w-0 p-5 sm:p-8 lg:p-10"><div className="mx-auto w-full max-w-5xl">
          <OrganizationSettingsHeader key={organizationId} section={i18n(`organization.settings.${['workspaces', 'members', 'variables', 'permissions'].includes(section) ? section : 'workspaces'}`)} />
          <Outlet />
        </div></main>
      </div>
    </MentionScopeProvider>
  </OrganizationSettingsProvider>
}
