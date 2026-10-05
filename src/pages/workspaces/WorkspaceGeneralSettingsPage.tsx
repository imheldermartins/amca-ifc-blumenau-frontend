import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Switch } from 'cubs-components'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import { workspacePreference } from '@/lib/workspacePreference'
import { useWorkspaceSettings } from './useWorkspaceSettings'

export function WorkspaceGeneralSettingsPage() {
  const workspace = useWorkspaceSettings()
  const { user } = useAuth()
  const [, refreshPreference] = useState(0)
  const checked = Boolean(user && workspacePreference.get(user.id) === workspace.id)
  return <section aria-labelledby="workspace-entry-title" className="rounded-2xl border border-divider p-5 sm:p-6">
    <Typography variant="subtitle" as="h2" id="workspace-entry-title" className="mb-5 flex items-center gap-2"><Icon icon="lucide:log-in" className="size-4" />{i18n('pages.workspaces.settings.starting-point')}</Typography>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0"><Typography variant="body" as="p" id="workspace-preference-label">{i18n('pages.workspaces.selector.preferred')}</Typography><Typography variant="caption" as="p" id="workspace-preference-help" className="mt-1 text-foreground/60">{i18n('pages.workspaces.settings.preferred-help')}</Typography></div>
      <Switch checked={checked} disabled={!user} aria-labelledby="workspace-preference-label" aria-describedby="workspace-preference-help" onCheckedChange={(next) => {
        if (!user) return
        if (next) workspacePreference.set(user.id, workspace.id)
        else workspacePreference.clear(user.id)
        refreshPreference((current) => current + 1)
      }} />
    </div>
  </section>
}
