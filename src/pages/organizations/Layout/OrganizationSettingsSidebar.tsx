import { Link } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { SOFT_SELECTION_CLASSES } from 'cubs-components'
import { ContextBackButton } from '@/components/ContextBackButton'
import { useLanguage } from '@/contexts/LanguageContext'
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings'
import { i18n } from '@/lib/i18n'
import { can } from '@/services/AccessService'

export function OrganizationSettingsSidebar() {
  const organization = useOrganizationSettings()
  const { slug: lang } = useLanguage()
  const params = { lang, organizationId: organization.id }
  const sections = [
    { to: '/$lang/organizations/$organizationId/workspaces' as const, label: 'workspaces', icon: 'lucide:folders', visible: can(organization, 'read', 'workspaces') || can(organization, 'write', 'create') },
    { to: '/$lang/organizations/$organizationId/variables' as const, label: 'variables', icon: 'lucide:braces', visible: true },
    { to: '/$lang/organizations/$organizationId/members' as const, label: 'members', icon: 'lucide:users', visible: can(organization, 'read', 'members') || can(organization, 'write', 'add_members') },
    { to: '/$lang/organizations/$organizationId/permissions' as const, label: 'permissions', icon: 'lucide:shield-check', visible: can(organization, 'read', 'roles') || can(organization, 'write', 'create_org_roles') },
  ]
  return <aside className="flex min-w-0 flex-col border-b border-divider bg-contrast p-4 md:border-b-0 md:border-r">
    <ContextBackButton fallback={`/${lang}/workspaces?choose=true`} label={i18n('pages.workspaces.settings.back')} className="mb-7 w-fit justify-start" />
    <div className="mb-7 px-2"><p className="truncate font-semibold">{organization.name}</p><p className="mt-1 text-xs text-foreground/60">{i18n('organization.single')}</p></div>
    <p className="mb-2 px-2 text-xs text-foreground/60">{i18n('pages.workspaces.settings.navigation')}</p>
    <nav aria-label={i18n('organization.settings.navigation')} className="flex flex-wrap gap-1 md:flex-col">
      {sections.filter((section) => section.visible).map((section) => <Link key={section.label} to={section.to} params={params}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-active" activeProps={{ className: SOFT_SELECTION_CLASSES }}>
        <Icon icon={section.icon} className="size-4 shrink-0" />{i18n(`organization.settings.${section.label}`)}
      </Link>)}
    </nav>
    <Link to="/$lang/workspaces" params={{ lang }} search={{ choose: true, tab: 'workspaces' }} className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 pt-8 text-sm">
      <Icon icon="lucide:arrow-left" className="size-4" />{i18n('pages.workspaces.settings.exit')}
    </Link>
  </aside>
}
