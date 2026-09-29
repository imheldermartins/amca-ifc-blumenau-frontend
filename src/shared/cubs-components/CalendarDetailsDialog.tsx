import { Icon } from '@iconify/react'
import * as Dialog from '@radix-ui/react-dialog'
import dayjs from 'dayjs'
import type { ReactNode } from 'react'

import { CalendarItemContent } from './Calendar'
import type { CalendarItem, CalendarRenderers, mappedItemsTypes } from './calendar/types'
import { formatCalendarDate } from './calendar/layout'
import { cn } from './lib/utils'

export interface CalendarDetailsDialogLabels {
  close: string
  description: string
  source: string
  properties: string
}

export interface CalendarDetailsDialogProps<M extends object = mappedItemsTypes> {
  item: CalendarItem<M> | null
  onOpenChange: (open: boolean) => void
  locale?: string
  source?: ReactNode
  renderers?: CalendarRenderers<M>
  renderDetails?: (item: CalendarItem<M>) => ReactNode
  renderActions?: (item: CalendarItem<M>) => ReactNode
  labels?: Partial<CalendarDetailsDialogLabels>
  className?: string
}

const DEFAULT_LABELS: CalendarDetailsDialogLabels = {
  close: 'Fechar detalhes',
  description: 'Detalhes do item do calendário',
  source: 'Origem',
  properties: 'Propriedades',
}

/** Controlled, API-free details surface shared by database and schedule calendars. */
export function CalendarDetailsDialog<M extends object = mappedItemsTypes>({
  item,
  onOpenChange,
  locale = 'pt-BR',
  source,
  renderers,
  renderDetails,
  renderActions,
  labels: labelOverrides,
  className,
}: CalendarDetailsDialogProps<M>) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const end = item?.end && item.allDay
    ? dayjs(item.end).subtract(1, 'day').format('YYYY-MM-DD')
    : item?.end

  return (
    <Dialog.Root open={Boolean(item)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn('fixed left-1/2 top-1/2 z-50 max-h-[min(760px,calc(100dvh-24px))] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-divider bg-background p-4 shadow-xl outline-none', className)}
        >
          <Dialog.Title className="pr-9 text-base font-bold leading-6">
            {item?.title ?? labels.description}
          </Dialog.Title>
          <Dialog.Description className="sr-only">{labels.description}</Dialog.Description>
          <Dialog.Close className="absolute right-3 top-3 rounded-md p-1.5 outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-p-purple" aria-label={labels.close}>
            <Icon icon="lucide:x" className="size-4" />
          </Dialog.Close>
          {item ? (
            <>
              <p className="mt-1 text-xs text-dark-100 dark:text-light-900">
                {formatCalendarDate(item.start, locale, { dateStyle: 'medium', ...(!item.allDay && { timeStyle: 'short' }) })}
                {end ? ` → ${formatCalendarDate(end, locale, { dateStyle: 'medium', ...(!item.allDay && { timeStyle: 'short' }) })}` : null}
              </p>
              {source ? <p className="mt-2 text-xs text-dark-100 dark:text-light-900"><span className="font-medium text-foreground">{labels.source}:</span> {source}</p> : null}
              <div className="mt-4 border-t border-divider pt-4 text-sm">
                {renderDetails ? renderDetails(item) : <CalendarItemContent item={item} renderers={renderers} />}
              </div>
              {renderActions ? <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-divider pt-4">{renderActions(item)}</div> : null}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
