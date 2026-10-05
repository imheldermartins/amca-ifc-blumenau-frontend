import { Icon } from '@iconify/react'
import { Link } from '@tanstack/react-router'
import { useLayoutEffect, useRef, useState } from 'react'
import { SOFT_SELECTION_CLASSES, Tooltip } from 'cubs-components'
import { Avatar } from '@/components/Avatar'
import { ContextBackButton } from '@/components/ContextBackButton'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { i18n } from '@/lib/i18n'
import { assignUserVisualIdentities } from '@/lib/userVisualIdentity'
import { defineWorkspaceAbility } from '@/lib/workspaceAbility'
import { useWorkspaceSettings } from './useWorkspaceSettings'

export function WorkspaceSettingsSidebar() {
  const workspace = useWorkspaceSettings()
  const { user } = useAuth()
  const { slug: lang } = useLanguage()
  const ability = defineWorkspaceAbility(workspace)
  const avatar = user ? assignUserVisualIdentities([user])[0] : undefined
  const emailRef = useRef<HTMLSpanElement>(null)
  const [emailOverflow, setEmailOverflow] = useState(false)
  useLayoutEffect(() => {
    const element = emailRef.current
    if (!element) return
    const measure = () => {
      const current = emailRef.current
      setEmailOverflow(Boolean(current && current.scrollWidth > current.clientWidth))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element.parentElement ?? element)
    return () => observer.disconnect()
  }, [user?.email])
  const sections = [
    { to: '/$lang/workspaces/$workspaceId/settings/general' as const, label: 'general', icon: 'lucide:settings-2', subject: 'WorkspaceSettings' as const },
    { to: '/$lang/workspaces/$workspaceId/settings/members' as const, label: 'members', icon: 'lucide:users', subject: 'WorkspaceMembers' as const },
    { to: '/$lang/workspaces/$workspaceId/settings/permissions' as const, label: 'permissions', icon: 'lucide:shield-check', subject: 'WorkspacePermissions' as const },
  ]
  return <aside className="flex min-w-0 flex-col border-b border-divider bg-contrast p-4 md:border-b-0 md:border-r">
    <ContextBackButton fallback={`/${lang}/page/${workspace.pageRootId}`} label={i18n('pages.workspaces.settings.back-to-workspace')} className="mb-7 justify-start" />
    <div className="mb-7 flex min-w-0 items-center gap-3 px-2">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-active"><Icon icon={workspace.icon} className="size-5" /></span>
      <div className="min-w-0"><Typography variant="subtitle" as="p" className="truncate">{workspace.name ?? i18n('common.workspace.sem-nome')}</Typography><Typography variant="caption" as="p" className="text-foreground/60">{workspace.isPersonal ? i18n('pages.workspaces.settings.personal-space') : workspace.organizationName}</Typography></div>
    </div>
    <Typography variant="caption" as="p" className="mb-2 px-2 text-foreground/60">{i18n('pages.workspaces.settings.navigation')}</Typography>
    <nav aria-label={i18n('pages.workspaces.settings.navigation')} className="flex flex-wrap gap-1 md:flex-col">
      {sections.filter((section) => ability.can('manage', section.subject)).map((section) => <Link key={section.to} to={section.to} params={{ lang, workspaceId: workspace.id }} search={{}}
        activeProps={{ className: SOFT_SELECTION_CLASSES }} inactiveProps={{ className: 'hover:bg-active' }} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium">
        <Icon icon={section.icon} className="size-4" />{i18n('pages.workspaces.settings.' + section.label)}
      </Link>)}
    </nav>
    <div className="mt-auto pt-8">
      <Link to="/$lang/workspaces" params={{ lang }} search={{ choose: true, tab: 'workspaces' }} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm hover:bg-active"><Icon icon="lucide:layout-grid" className="size-4 shrink-0" />{i18n('pages.workspaces.settings.exit')}</Link>
      {user && avatar && <div className="mt-4 flex min-w-0 items-center gap-3 border-t border-divider px-2 pt-5">
        <Avatar slug={avatar.slug} color={avatar.color} label={user.name || user.email} className="size-8 shrink-0 ring-0" />
        <div className="min-w-0 flex-1"><Typography variant="subtitle" as="p" className="truncate text-sm">{user.name || user.email.split('@')[0]}</Typography>
          <Typography variant="caption" as="p" className="text-foreground/60"><Tooltip content={emailOverflow ? user.email : ''}>
            <span ref={emailRef} className="block truncate" tabIndex={emailOverflow ? 0 : undefined}>{user.email}</span>
          </Tooltip></Typography>
        </div>
      </div>}
    </div>
  </aside>
}
