import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'
import type { HeaderCol } from '../types'

export function FlowActionButton({ column, disabled, pending, onClick }: {
  column: HeaderCol
  disabled?: boolean
  pending?: boolean
  onClick?: () => void
}) {
  const label = column.flowButton?.label ?? null
  return <button type="button" aria-label={label || `Executar ${column.title || 'Flow'}`}
    title={disabled ? 'Coluna bloqueada ou execução indisponível' : label || column.title}
    disabled={disabled || pending} onClick={onClick} aria-busy={pending || undefined}
    className={cn('inline-flex shrink-0 items-center justify-center gap-1.5 border border-p-purple bg-p-purple/10 text-p-purple transition-colors hover:bg-p-purple hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple/40 disabled:cursor-not-allowed disabled:opacity-40',
      label ? 'rounded-md px-2 py-1 text-xs font-semibold' : 'size-8 rounded-full')}>
    <Icon icon={pending ? 'lucide:loader-circle' : column.flowButton?.icon || 'lucide:play'} className={cn('size-4 shrink-0', pending && 'animate-spin')} />
    {label}
  </button>
}
