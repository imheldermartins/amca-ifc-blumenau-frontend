import { Icon } from '@iconify/react'
import { Button, cn } from 'cubs-components'

export type DatabaseViewToolbarSyncState = 'confirmed' | 'pending' | 'saving' | 'error'

export interface DatabaseViewToolbarSyncStatus {
  state: DatabaseViewToolbarSyncState
  /** Texto já localizado pelo host, incluindo o tempo relativo quando houver. */
  label: string
  /** Rótulo localizado de “Atualizar” ou “Tentar novamente”. */
  actionLabel?: string
  /** Pending adota o remoto; error tenta salvar de novo. */
  onAction?: () => void
}

export interface DatabaseViewSyncStatusProps {
  status: DatabaseViewToolbarSyncStatus
}

/** Indicador visual puro; a persistência/realtime continuam no app host. */
export function DatabaseViewSyncStatus({ status }: DatabaseViewSyncStatusProps) {
  return (
    <div
      role={status.state === 'error' ? 'alert' : 'status'}
      data-filter-sync-state={status.state}
      className={cn(
        'flex min-h-8 min-w-0 items-center gap-1.5 text-xs',
        status.state === 'pending' && 'text-p-purple',
        status.state === 'error' && 'text-p-red',
        (status.state === 'confirmed' || status.state === 'saving') &&
          'text-dark-100 dark:text-light-900',
      )}
    >
      {status.state === 'saving' ? (
        <Icon aria-hidden="true" icon="lucide:loader-circle" className="shrink-0 animate-spin" />
      ) : status.state === 'error' ? (
        <Icon aria-hidden="true" icon="lucide:circle-alert" className="shrink-0" />
      ) : null}
      <span className="min-w-0 truncate whitespace-nowrap">{status.label}</span>
      {status.actionLabel && status.onAction ? (
        <Button
          type="button"
          variant={status.state === 'pending' ? 'filled' : 'outlined'}
          color={status.state === 'pending' ? 'purple' : 'red'}
          className="h-7 shrink-0 px-2 text-xs"
          onClick={status.onAction}
        >
          {status.actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
