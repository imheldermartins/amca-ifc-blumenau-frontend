import { cn } from 'cubs-components'

import type { ColumnOption } from '../../types'
import { OPTION_COLOR_CLASSES } from './optionColors'

/**
 * Chip de uma option de select — o MESMO render nos dois modos da célula
 * (read-only e editor) e na lista do Popover. Option sem cor (ou com cor fora
 * do vocabulário) cai no chip neutro `bg-active`.
 */
export function OptionChip({ option, className }: { option: ColumnOption; className?: string }) {
  const colorClasses = option.color ? OPTION_COLOR_CLASSES[option.color] : undefined

  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs whitespace-nowrap',
        colorClasses ?? 'bg-active',
        className,
      )}
    >
      {option.label}
    </span>
  )
}
