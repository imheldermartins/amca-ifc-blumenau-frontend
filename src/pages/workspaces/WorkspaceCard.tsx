import { Icon } from '@iconify/react'
import type { ReactNode } from 'react'
import { cn, Switch } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'

export function WorkspaceCard({ id, name, icon, ownerLabel, compact = false, preference, children }: {
  id: string
  name: string
  icon?: string | null
  ownerLabel?: string
  compact?: boolean
  preference?: { checked: boolean; onCheckedChange: (checked: boolean) => void }
  children: ReactNode
}) {
  return <li data-workspace-card={id} className={cn('flex w-full min-w-0 flex-col gap-3 rounded-2xl border border-divider-contrast p-2', compact ? 'bg-active/35' : 'bg-background')}>
    {preference && <Switch
      checked={preference.checked}
      onCheckedChange={preference.onCheckedChange}
      label={i18n('pages.workspaces.selector.preferred')}
      className="w-full gap-1.5 px-1 pt-1 text-[11px]"
    />}
    <div className="flex min-w-0 items-center gap-2 rounded-lg bg-transparent p-2">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-active">
        <Icon icon={icon || 'lucide:boxes'} className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <Typography variant="body" as="h3" title={name} className="truncate text-sm font-semibold">{name}</Typography>
        {ownerLabel && <Typography variant="caption" as="p" title={ownerLabel} className="truncate text-[11px] text-foreground/60">{ownerLabel}</Typography>}
      </div>
    </div>
    <div className={cn('mt-auto flex items-center gap-1.5', compact ? 'justify-end' : 'flex-col')}>{children}</div>
  </li>
}
