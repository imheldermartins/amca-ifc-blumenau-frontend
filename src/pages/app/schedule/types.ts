import type { CalendarItem, CalendarProperty, OptionColor, mappedItemsTypes } from 'cubs-components'

export interface ScheduleProperty extends CalendarProperty {
  type?: string
  color?: OptionColor
}

export interface ScheduleItemTypes extends mappedItemsTypes {
  page: {
    page: { id: string; title: string }
    sourcePageId: string
    sourceTitle?: string | null
    dateColumnId: string
    colorColumnId?: string | null
    properties: ScheduleProperty[]
  }
  chart: { source: string; values: number[] }
}

export type ScheduleItem = CalendarItem<ScheduleItemTypes>

export interface PinnedSchedulePageDto {
  id: string
  workspaceId: string
  pageId: string
  sourcePageId: string
  sourceTitle: string | null
  title: string
  dateColumnId: string
  colorColumnId: string | null
  start: string
  end?: string
  allDay: boolean
  color: OptionColor
  properties: Array<{
    id: string
    label: string
    value: unknown
    type?: string
    color?: OptionColor
  }>
  pinnedAt: string
}

export function pinnedPageToCalendarItem(pin: PinnedSchedulePageDto): ScheduleItem {
  return {
    id: pin.pageId,
    type: 'page',
    title: pin.title,
    start: pin.start,
    ...(pin.end ? { end: pin.end } : {}),
    allDay: pin.allDay,
    color: pin.color,
    data: {
      page: { id: pin.pageId, title: pin.title },
      sourcePageId: pin.sourcePageId,
      sourceTitle: pin.sourceTitle,
      dateColumnId: pin.dateColumnId,
      colorColumnId: pin.colorColumnId,
      properties: pin.properties.map((property) => ({ ...property, value: String(property.value) })),
    },
  }
}
