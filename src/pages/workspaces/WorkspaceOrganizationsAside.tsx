import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button, Switch, Tooltip } from 'cubs-components'

import { i18n } from '@/lib/i18n'
import type { ApiWorkspace } from '@/services/WorkspaceService'
import { can } from '@/services/AccessService'

export interface WorkspaceOrganizationGroup {
  id: string
  name: string
  canCreate: boolean
  canView?: boolean
  workspaces: ApiWorkspace[]
}

export function WorkspaceOrganizationsAside({ groups, onSelect, onCreate, onEnter, onSettings, preferredId, onPrefer }: {
  groups: WorkspaceOrganizationGroup[]
  onSelect: (organizationId: string) => void
  onCreate: (organizationId: string) => void
  onEnter: (workspace: ApiWorkspace) => void
  onSettings?: (workspace: ApiWorkspace) => void
  preferredId?: string | null
  onPrefer?: (workspace: ApiWorkspace, checked: boolean) => void
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const expand = (id: string) => setCollapsedIds((current) => { const next = new Set(current); next.delete(id); return next })
  return <ul className="divide-y divide-divider">
    {groups.map((group) => {
      const expanded = !collapsedIds.has(group.id)
      return <li key={group.id}>
        <div className="flex items-center gap-2 py-2">
          {group.canCreate ? <Tooltip content={i18n('pages.workspaces.selector.new')}><Button type="button" variant="text" color="purple" className="size-8 shrink-0 p-1.5"
            aria-label={i18n('pages.workspaces.selector.new-in-organization', { name: group.name })} onClick={() => { expand(group.id); onCreate(group.id) }}><Icon icon="lucide:plus" className="size-4" /></Button></Tooltip> : <span className="size-8 shrink-0" />}
          <button
            type="button"
            disabled={group.canView === false}
            className="min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-xl font-semibold transition-colors hover:bg-active disabled:cursor-default"
            onClick={() => onSelect(group.id)}
          >{group.name}</button>
          <button
            type="button"
            aria-label={i18n('pages.workspaces.selector.toggle-organization', { name: group.name })}
            aria-expanded={expanded}
            className="rounded-lg p-1 text-foreground/60 hover:bg-active"
            onClick={() => setCollapsedIds((current) => {
              const next = new Set(current)
              if (next.has(group.id)) next.delete(group.id)
              else next.add(group.id)
              return next
            })}
          ><Icon icon={expanded ? 'lucide:chevron-down' : 'lucide:chevron-right'} className="size-4" /></button>
        </div>
        {expanded && <ul className="mb-3 ml-6 border-l border-divider pl-4">
          {group.workspaces.map((workspace) => <li key={workspace.id} data-workspace-entry={workspace.id} className="flex min-w-0 items-center gap-2 py-1">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left text-base text-foreground/70 transition-colors hover:bg-active hover:text-foreground"
              onClick={() => onEnter(workspace)}
            >
              <Icon icon={workspace.icon} className="size-4 shrink-0 text-p-purple" /><span className="min-w-0 flex-1 truncate">{workspace.name ?? i18n('pages.workspaces.selector.unnamed')}</span>
              <Icon icon="lucide:chevron-right" className="size-3.5 shrink-0" />
            </button>
            {onPrefer && <Switch aria-label={i18n('organization.settings.preferred', { name: workspace.name })} checked={preferredId === workspace.id} onCheckedChange={(checked) => onPrefer(workspace, checked)} />}
            {onSettings && can(workspace, 'write', 'update') && <button type="button" aria-label={i18n('organization.settings.workspace-settings', { name: workspace.name })} className="rounded-lg p-2 opacity-60 hover:bg-active" onClick={() => onSettings(workspace)}><Icon icon="lucide:settings-2" className="size-4" /></button>}
          </li>)}
          {!group.workspaces.length && <li className="py-3 text-sm opacity-50">{i18n('pages.workspaces.selector.organization-empty')}</li>}
        </ul>}
      </li>
    })}
  </ul>
}
