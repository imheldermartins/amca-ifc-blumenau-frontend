import type { ReactNode } from 'react'
import type { OptionColor } from '../lib/optionColors'

export type CalendarMode = 'month' | 'week' | 'day'

export interface CalendarProperty {
  id: string
  label: string
  value: ReactNode
}

/** Extend this map to use your own payloads, including external items/charts. */
export interface mappedItemsTypes {
  page: { page: { id: string; title: string }; properties?: CalendarProperty[] }
  item: { properties?: CalendarProperty[] }
}

export interface CalendarInterval {
  id: string
  title: string
  /** Display dates: YYYY-MM-DD or ISO, interpreted in UTC without browser shifts. */
  start: string
  /** Exclusive end. Omit for a single day or a 30-minute timed item. */
  end?: string
  allDay?: boolean
  color?: OptionColor
}

export type CalendarItem<M extends object = mappedItemsTypes> = {
  [K in keyof M & string]: CalendarInterval & {
    type: K
    data: M[K]
    children?: CalendarItem<M>[]
  }
}[keyof M & string]

export type CalendarRenderers<M extends object = mappedItemsTypes> = {
  [K in keyof M & string]: (data: M[K], item: Extract<CalendarItem<M>, { type: K }>) => ReactNode
}

export interface CalendarLabels {
  calendar: string
  allDay: string
  more: (count: number) => string
}

export interface CalendarProps<M extends object = mappedItemsTypes> {
  items: CalendarItem<M>[]
  date: string
  mode?: CalendarMode
  locale?: string
  weekStartsOn?: 0 | 1
  labels?: Partial<CalendarLabels>
  renderers?: CalendarRenderers<M>
  onDateChange?: (date: string) => void
  onItemClick?: (item: CalendarItem<M>) => void
  /** Altura dos charts no mês. Mantém o default compacto para consumidores existentes. */
  monthItemHeight?: number
  className?: string
}
