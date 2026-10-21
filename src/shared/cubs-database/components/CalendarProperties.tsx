import { cn } from 'cubs-components'

import type { DatabaseCalendarProperty } from '../calendarItems'
import { mappedProps } from '../calendarPropertyRenderers'

export interface CalendarPropertiesProps {
  properties: DatabaseCalendarProperty[]
  compact?: boolean
  showLabels?: boolean
  className?: string
}

/** Área reutilizada pelos charts e pela modal de detalhes. */
export function CalendarProperties({ properties, compact = false, showLabels = true, className }: CalendarPropertiesProps) {
  return (
    <dl
      data-calendar-properties
      className={cn(
        'flex w-full min-w-0 max-w-full flex-col items-start justify-start gap-2 overflow-hidden',
        compact && 'gap-1 text-sm leading-4',
        className,
      )}
    >
      {properties.map((property) => {
        const render = mappedProps[property.type]
        const content = render(property, { compact })
        if (content === null || content === undefined) return null
        return (
          <div key={property.id} className={cn('flex w-full min-w-0 max-w-full items-start justify-start overflow-hidden', showLabels && 'gap-1.5')}>
            <dt className={cn('min-w-0 max-w-[50%] shrink truncate text-dark-100 dark:text-light-900', !showLabels && 'sr-only')}>{property.label}:</dt>
            <dd className="min-w-0 max-w-full flex-1 overflow-hidden">{content}</dd>
          </div>
        )
      })}
    </dl>
  )
}
