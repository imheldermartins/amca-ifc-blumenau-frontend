import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'
import type { ReactNode } from 'react'

import type { DatabaseCalendarProperty } from './calendarItems'
import type { ColumnDataType } from './types'
import { OptionChip } from './components/cells/OptionChip'

export interface CalendarPropertyRenderContext {
  compact: boolean
}

export type CalendarPropertyRenderer = (
  property: DatabaseCalendarProperty,
  context: CalendarPropertyRenderContext,
) => ReactNode

/**
 * Renderers visuais por tipo de coluna. A projeção conserva o valor cru e o
 * tipo; esta é a única camada que decide como cada propriedade aparece.
 */
export const mappedProps: Record<ColumnDataType, CalendarPropertyRenderer> = {
  text: ({ value }) => <span className="block max-w-full truncate">{value}</span>,
  numeric: ({ value }) => <span className="block max-w-full truncate tabular-nums">{value}</span>,
  date: ({ value }) => <span className="block max-w-full truncate tabular-nums">{value}</span>,
  checkbox: ({ rawValue }) => (
    <span className="inline-flex items-center gap-1">
      <Icon
        icon={rawValue ? 'lucide:circle-check' : 'lucide:circle'}
        className={cn('shrink-0', rawValue ? 'text-p-green' : 'opacity-40')}
        aria-hidden
      />
      <span>{rawValue ? 'Sim' : 'Não'}</span>
    </span>
  ),
  select: ({ column, rawValue }, { compact }) => {
    const option = typeof rawValue === 'string'
      ? column.options?.find((candidate) => candidate.id === rawValue)
      : undefined
    return option ? (
      <OptionChip
        option={option}
        className={cn('inline-block max-w-full truncate', compact && 'px-1 py-0 text-xs leading-4')}
      />
    ) : <span className="opacity-60">—</span>
  },
}
