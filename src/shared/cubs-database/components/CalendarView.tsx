import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import {
  Button,
  Calendar,
  CalendarDetailsDialog,
  CalendarYearPicker,
  Select,
  cn,
  formatCalendarDate,
  setCalendarYear,
  shiftCalendarDate,
  type CalendarItem,
  type CalendarRenderers,
} from 'cubs-components'

import type { CalendarPinInput, HeaderCol, RowData } from '../types'
import { databaseCalendarItems, type DatabaseCalendarItemTypes } from '../calendarItems'
import { CalendarProperties } from './CalendarProperties'

export interface CalendarViewLabels {
  calendar?: string
  previous?: string
  next?: string
  today?: string
  chooseYear?: string
  year?: string
  close?: string
  details?: string
  source?: string
  openPage?: string
  pin?: string
  unpin?: string
  requestPin?: string
  cancel?: string
  confirmUnpin?: string
  colorProperty?: string
  emptyDate?: string
}

export interface CalendarViewProps {
  rows: RowData[]
  columns: HeaderCol[]
  dateColumnId?: string
  colorColumnId?: string | null
  calendarPropertyIds?: string[]
  showPropertyLabels?: boolean
  onOpenRow?: (row: RowData) => void
  pinnedPageIds?: ReadonlySet<string>
  pendingPageId?: string | null
  onPin?: (input: CalendarPinInput) => void | boolean | Promise<boolean>
  onUnpin?: (pageId: string) => void | boolean | Promise<boolean>
  onRequestPin?: (input: CalendarPinInput) => void
  sourceTitle?: string
  locale?: string
  labels?: CalendarViewLabels
}

const iconButtonClass = 'flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-p-purple'

/** Monthly database projection. Agenda persistence is injected by the host. */
export function CalendarView({ rows, columns, dateColumnId, colorColumnId, calendarPropertyIds, showPropertyLabels = true, onOpenRow, pinnedPageIds, pendingPageId, onPin, onUnpin, onRequestPin, sourceTitle, locale = 'pt-BR', labels }: CalendarViewProps) {
  const dateColumn = dateColumnId ? columns.find((column) => column.id === dateColumnId && column.type === 'date') : columns.find((column) => column.type === 'date')
  const defaultColorColumn = colorColumnId ? columns.find((column) => column.id === colorColumnId && column.type === 'select') : columns.find((column) => column.type === 'select')
  const items = useMemo(() => databaseCalendarItems(rows, columns, dateColumn?.id, colorColumnId, calendarPropertyIds), [rows, columns, dateColumn?.id, colorColumnId, calendarPropertyIds])
  const [date, setDate] = useState(() => items[0]?.start.slice(0, 10) ?? new Date().toLocaleDateString('en-CA'))
  const [selected, setSelected] = useState<CalendarItem<DatabaseCalendarItemTypes> | null>(null)
  const [selectedColorColumnId, setSelectedColorColumnId] = useState<string | null | undefined>(defaultColorColumn?.id ?? colorColumnId)
  const [confirmingUnpin, setConfirmingUnpin] = useState(false)
  const currentDate = new Date().toLocaleDateString('en-CA')
  const selectedRow = selected ? rows.find((row) => row.id === selected.id) : undefined
  const isPinned = Boolean(selected && pinnedPageIds?.has(selected.id))
  const selectColumns = columns.filter((column) => column.type === 'select')
  const renderers = useMemo<CalendarRenderers<DatabaseCalendarItemTypes>>(() => ({
    page: ({ page, properties }) => <div className="flex min-w-0 flex-col items-start justify-start">
      <span data-calendar-title className="block w-full truncate text-sm font-medium leading-4">{page.title}</span>
      {properties?.length ? <CalendarProperties properties={properties} compact showLabels={showPropertyLabels} className="mt-1 w-full" /> : null}
    </div>,
  }), [showPropertyLabels])

  useEffect(() => {
    if (!selected) return
    const refreshed = items.find((item) => item.id === selected.id)
    if (refreshed && refreshed !== selected) setSelected(refreshed)
  }, [items, selected])

  const pinSelected = (nextColorColumnId = selectedColorColumnId) => {
    if (!selected || !dateColumn || !onPin) return
    return onPin({ pageId: selected.id, dateColumnId: dateColumn.id, colorColumnId: nextColorColumnId })
  }
  const requestSelected = () => {
    if (!selected || !dateColumn || !onRequestPin) return
    onRequestPin({ pageId: selected.id, dateColumnId: dateColumn.id, colorColumnId: selectedColorColumnId })
  }

  return <div data-database-calendar className="flex h-[max(720px,calc(100dvh-180px))] min-h-0 flex-col">
    <header className="flex shrink-0 flex-wrap items-center gap-1 border-y border-divider px-3 py-2">
      <h2 className="mr-1 text-lg font-bold capitalize tracking-tight" aria-live="polite">{formatCalendarDate(date, locale, { month: 'long' })}</h2>
      <CalendarYearPicker year={Number(date.slice(0, 4))} onChange={(year) => setDate(setCalendarYear(date, year))} chooseLabel={labels?.chooseYear ?? 'Selecionar ano'} yearLabel={labels?.year ?? 'Ano'} />
      <button type="button" className={iconButtonClass} aria-label={labels?.previous ?? 'Mês anterior'} title={labels?.previous ?? 'Mês anterior'} onClick={() => setDate(shiftCalendarDate(date, -1, 'month'))}><Icon icon="lucide:chevron-left" className="size-4" /></button>
      <button type="button" className={iconButtonClass} aria-label={labels?.next ?? 'Próximo mês'} title={labels?.next ?? 'Próximo mês'} onClick={() => setDate(shiftCalendarDate(date, 1, 'month'))}><Icon icon="lucide:chevron-right" className="size-4" /></button>
      <button type="button" onClick={() => setDate(currentDate)} className="ml-1 rounded-md border border-divider px-2.5 py-1 text-xs font-medium hover:bg-contrast">{labels?.today ?? 'Hoje'}</button>
    </header>
    <div className="relative min-h-0 flex-1 border-b border-divider">
      <Calendar items={items} date={date} locale={locale} monthItemHeight={64} onDateChange={setDate} renderers={renderers} labels={{ calendar: labels?.calendar ?? 'Calendário' }} onItemClick={(item) => {
        setSelected(item)
        setSelectedColorColumnId(defaultColorColumn?.id ?? colorColumnId)
        setConfirmingUnpin(false)
      }} />
      {!dateColumn ? <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/85 p-6 text-center text-sm text-dark-100 dark:text-light-900"><p className="max-w-sm">{labels?.emptyDate ?? 'Adicione uma propriedade de data ou selecione uma nas configurações desta view.'}</p></div> : null}
    </div>
    <CalendarDetailsDialog item={selected} onOpenChange={(open) => { if (!open) { setSelected(null); setConfirmingUnpin(false) } }} locale={locale} source={sourceTitle} renderers={renderers} labels={{ close: labels?.close ?? 'Fechar detalhes', description: labels?.details ?? 'Detalhes da página', source: labels?.source ?? 'Origem' }}
      renderDetails={(item) => <>
        {item.type === 'page' && item.data.properties?.length ? <CalendarProperties properties={item.data.properties} showLabels={showPropertyLabels} /> : null}
        {selectColumns.length ? <div className="mt-4"><Select label={labels?.colorProperty ?? 'Cor pela propriedade'} aria-label={labels?.colorProperty ?? 'Cor pela propriedade'} value={selectedColorColumnId ?? selectColumns[0].id} options={selectColumns.map((column) => ({ value: column.id, label: column.title }))} onValueChange={(value) => {
          setSelectedColorColumnId(value)
          if (isPinned) void Promise.resolve(pinSelected(value)).then((saved) => { if (saved === false) setSelectedColorColumnId(defaultColorColumn?.id ?? colorColumnId) })
        }} /></div> : null}
      </>}
      renderActions={(item) => confirmingUnpin ? <>
        <span className="mr-auto text-xs text-dark-100 dark:text-light-900">A página continuará disponível.</span>
        <Button variant="text" color="from-theme" onClick={() => setConfirmingUnpin(false)}>{labels?.cancel ?? 'Cancelar'}</Button>
        <Button variant="filled" color="purple" disabled={pendingPageId === item.id} onClick={() => { if (onUnpin) void Promise.resolve(onUnpin(item.id)).then((saved) => { if (saved !== false) setConfirmingUnpin(false) }) }}>{labels?.confirmUnpin ?? 'Desafixar'}</Button>
      </> : <>
        {onOpenRow && selectedRow ? <Button variant="text" color="from-theme" onClick={() => onOpenRow(selectedRow)}>{labels?.openPage ?? 'Abrir página'}</Button> : null}
        {onRequestPin ? <Button variant="text" color="from-theme" onClick={requestSelected}><Icon icon="lucide:send" className="mr-2 size-4" />{labels?.requestPin ?? 'Solicitar fixação'}</Button> : null}
        {onPin ? <Button variant="filled" color="purple" disabled={pendingPageId === item.id} onClick={() => { if (isPinned) setConfirmingUnpin(true); else pinSelected() }}><Icon icon={pendingPageId === item.id ? 'lucide:loader-circle' : isPinned ? 'solar:pin-bold' : 'lucide:pin'} className={cn('mr-2 size-4', pendingPageId === item.id && 'animate-spin')} />{labels?.[isPinned ? 'unpin' : 'pin'] ?? (isPinned ? 'Desafixar da agenda' : 'Fixar na agenda')}</Button> : null}
      </>}
    />
  </div>
}
