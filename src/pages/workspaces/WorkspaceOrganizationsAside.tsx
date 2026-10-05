import { Icon } from '@iconify/react'
import { useState } from 'react'
import { Button, cn, SOFT_SELECTION_CLASSES, Tooltip } from 'cubs-components'

import { i18n } from '@/lib/i18n'
import type { ApiWorkspace } from '@/services/WorkspaceService'

export interface WorkspaceOrganizationGroup {
  id: string
  name: string
  canCreate: boolean
  workspaces: ApiWorkspace[]
}

export function WorkspaceOrganizationsAside({ groups, selectedId, onSelect, onCreate, onEnter }: {
  groups: WorkspaceOrganizationGroup[]
  selectedId?: string
  onSelect: (organizationId: string) => void
  onCreate: (organizationId: string) => void
  onEnter: (workspace: ApiWorkspace) => void
}) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  return <ul className="flex flex-col gap-3">
    {groups.map((group) => {
      const expanded = !collapsedIds.has(group.id)
      return <li key={group.id}>
        <div className="flex items-center gap-1 border-b border-divider pb-1">
          <button
            type="button"
            aria-pressed={selectedId === group.id}
            className={cn('min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors', selectedId === group.id ? SOFT_SELECTION_CLASSES : 'hover:bg-active')}
            onClick={() => {
              onSelect(group.id)
              setCollapsedIds((current) => { const next = new Set(current); next.delete(group.id); return next })
            }}
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
          ><Icon icon={expanded ? 'lucide:chevron-up' : 'lucide:chevron-down'} className="size-4" /></button>
          {group.canCreate && <Tooltip content={i18n('pages.workspaces.selector.new')}><Button
            type="button" className="size-6 shrink-0 rounded-full p-1"
            aria-label={i18n('pages.workspaces.selector.new-in-organization', { name: group.name })}
            onClick={() => onCreate(group.id)}
          ><Icon icon="lucide:plus" className="size-3.5" /></Button></Tooltip>}
        </div>
        {expanded && group.workspaces.length > 0 && <ul className="ml-4 mt-1 border-l border-divider pl-1">
          {group.workspaces.map((workspace) => <li key={workspace.id}>
            <button
              type="button"
              className="flex w-full min-w-0 items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm text-foreground/70 transition-colors hover:bg-active hover:text-foreground"
              onClick={() => onEnter(workspace)}
            >
              <span className="min-w-0 flex-1 truncate">{workspace.name ?? i18n('pages.workspaces.selector.unnamed')}</span>
              <Icon icon="lucide:chevron-right" className="size-3.5 shrink-0" />
            </button>
          </li>)}
        </ul>}
      </li>
    })}
  </ul>
}
