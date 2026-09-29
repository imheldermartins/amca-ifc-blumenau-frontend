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
        'flex min-w-0 max-w-full flex-col items-start justify-start gap-2',
        compact && 'gap-1 text-sm leading-4',
        className,
      )}
    >
      {properties.map((property) => {
        const render = mappedProps[property.type]
        return (
          <div key={property.id} className={cn('flex min-w-0 max-w-full items-start justify-start', showLabels && 'gap-1.5')}>
            <dt className={cn('shrink-0 text-dark-100 dark:text-light-900', !showLabels && 'sr-only')}>{property.label}:</dt>
            <dd className="min-w-0 max-w-full overflow-hidden">{render(property, { compact })}</dd>
          </div>
        )
      })}
    </dl>
  )
}
