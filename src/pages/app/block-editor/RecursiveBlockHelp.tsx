import { Icon } from '@iconify/react'
import { Tooltip, cn } from 'cubs-components'
import { i18n } from '@/lib/i18n'

export function RecursiveBlockHelp({ kind, className }: { kind: 'table' | 'calendar'; className?: string }) {
  return <Tooltip content={i18n(`recursive.${kind}-description`)}>
    <button type="button" aria-label={i18n('recursive.help', { block: i18n(`recursive.${kind}`) })}
      className={cn('inline-flex size-5 shrink-0 items-center justify-center rounded-full text-foreground/50 hover:text-p-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple/40', className)}>
      <Icon icon="lucide:circle-help" aria-hidden="true" className="size-4" />
    </button>
  </Tooltip>
}
