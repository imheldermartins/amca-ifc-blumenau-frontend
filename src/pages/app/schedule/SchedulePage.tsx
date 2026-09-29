import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { useNavigate } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import dayjs from 'dayjs'
import {
  Button,
  Calendar,
  CalendarDetailsDialog,
  CalendarYearPicker,
  OPTION_COLOR_SWATCH,
  Select,
  cn,
  formatCalendarDate,
  setCalendarYear,
  shiftCalendarDate,
  type CalendarMode,
  type CalendarProperty,
  type CalendarRenderers,
} from 'cubs-components'

import { Modal } from '@/components/Modal'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useSchedule } from '@/hooks/useSchedule'
import { i18n } from '@/lib/i18n'
import { createPageNavigationState } from '@/lib/pageNavigation'
import { THEME } from '@/lib/theme'
import { createScheduleMock, scheduleItemColor } from './mockData'
import { pinnedPageToCalendarItem, type ScheduleItem, type ScheduleItemTypes } from './types'

const t = (key: string) => i18n(`pages.app.schedule.${key}`)
const modes: CalendarMode[] = ['month', 'week', 'day']
const flatten = (items: ScheduleItem[]): ScheduleItem[] => items.flatMap((item) => [item, ...flatten(item.children ?? [])])

function ItemProperties({ properties = [] }: { properties?: CalendarProperty[] }) {
  return <span className="block truncate text-[10px] opacity-70">{properties.map(({ id, label, value }, index) => <span key={id}>{index > 0 && ' · '}{label}: {value}</span>)}</span>
}

const renderers: CalendarRenderers<ScheduleItemTypes> = {
  page: (data, item) => <><span data-calendar-title className="block truncate font-semibold">{!item.allDay && `${item.start.slice(11, 16)} · `}{data.page.title}</span><ItemProperties properties={data.properties} /></>,
  item: (data, item) => <><span data-calendar-title className="block truncate font-semibold">{item.title}</span><ItemProperties properties={data.properties} /></>,
  chart: (data, item) => <><span data-calendar-title className="block truncate font-semibold">{item.title}</span><span className="block text-[10px] opacity-70">{data.source}</span><span className="mt-2 flex h-7 items-end gap-1" aria-hidden="true">{data.values.map((value, index) => <span key={index} className="w-2 rounded-t-sm bg-current opacity-50" style={{ height: `${value}%` }} />)}</span></>,
}

const timeGridRenderers: CalendarRenderers<ScheduleItemTypes> = {
  page: (data, item) => <span data-calendar-title className="block truncate font-semibold">{!item.allDay && `${item.start.slice(11, 16)} · `}{data.page.title}</span>,
  item: (_data, item) => <span data-calendar-title className="block truncate font-semibold">{!item.allDay && `${item.start.slice(11, 16)} · `}{item.title}</span>,
  chart: (_data, item) => <span data-calendar-title className="block truncate font-semibold">{!item.allDay && `${item.start.slice(11, 16)} · `}{item.title}</span>,
}

function IconButton({ icon, label, onClick, pressed }: { icon: string; label: string; onClick: () => void; pressed?: boolean }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={onClick} className={cn('flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-p-purple', pressed && 'bg-p-purple/10 text-p-purple')}><Icon icon={icon} className="size-4" /></button>
}

interface ScheduleSurfaceProps {
  items: ScheduleItem[]
  pinnedIds: ReadonlySet<string>
  pendingPageId?: string | null
  onPin: (item: Extract<ScheduleItem, { type: 'page' }>, colorColumnId?: string | null) => void | boolean | Promise<boolean>
  onUnpin: (item: Extract<ScheduleItem, { type: 'page' }>) => void | boolean | Promise<boolean>
  onOpenPage?: (item: Extract<ScheduleItem, { type: 'page' }>) => void
}

export function ScheduleSurface({ items, pinnedIds, pendingPageId, onPin, onUnpin, onOpenPage }: ScheduleSurfaceProps) {
  const { locale } = useLanguage()
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [mode, setMode] = useState<CalendarMode>('month')
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  const [selected, setSelected] = useState<ScheduleItem | null>(null)
  const [pendingUnpin, setPendingUnpin] = useState<Extract<ScheduleItem, { type: 'page' }> | null>(null)
  const reducedMotion = useReducedMotion()
  const allItems = useMemo<ScheduleItem[]>(() => flatten(items).map((item) => ({ ...item, children: undefined })), [items])
  const pinnedPages = allItems.filter((item) => item.type === 'page' && pinnedIds.has(item.id)) as Array<Extract<ScheduleItem, { type: 'page' }>>

  useEffect(() => {
    if (!selected) return
    const refreshed = allItems.find((item) => item.id === selected.id)
    if (refreshed && refreshed !== selected) setSelected(refreshed)
  }, [allItems, selected])

  const page = selected?.type === 'page' ? selected : null
  const selectProperties = page?.data.properties.filter((property) => property.type === 'select') ?? []
  const source = selected?.type === 'page' ? selected.data.sourceTitle : selected?.type === 'chart' ? selected.data.source : undefined
  const calendarRenderers = mode === 'month' ? renderers : timeGridRenderers

  return <section className="@container/schedule flex h-full min-h-[420px] min-w-0 flex-col overflow-hidden bg-background scheme-light dark:scheme-dark" aria-label={t('title')}>
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-divider px-3 py-2">
      <div className="flex items-center gap-1">
        <h1 className="mr-1 text-lg font-bold capitalize tracking-tight" aria-live="polite">{formatCalendarDate(date, locale, { month: 'long' })}</h1>
        <CalendarYearPicker year={Number(date.slice(0, 4))} onChange={(year) => setDate(setCalendarYear(date, year))} chooseLabel={t('chooseYear')} yearLabel={t('year')} />
        <IconButton icon="lucide:chevron-left" label={t('previous')} onClick={() => setDate(shiftCalendarDate(date, -1, mode))} />
        <IconButton icon="lucide:chevron-right" label={t('next')} onClick={() => setDate(shiftCalendarDate(date, 1, mode))} />
        <button type="button" onClick={() => setDate(dayjs().format('YYYY-MM-DD'))} className="ml-1 rounded-md border border-divider px-2.5 py-1 text-xs font-medium hover:bg-contrast">{t('today')}</button>
      </div>
      <div className="flex items-center gap-2">
        <div role="tablist" aria-label={t('period')} className="flex rounded-lg bg-contrast p-0.5" onKeyDown={(event) => {
          if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (modes.indexOf(mode) + (event.key === 'ArrowRight' ? 1 : 2)) % 3
          setMode(modes[index]); (event.currentTarget.children[index] as HTMLElement).focus()
        }}>
          {modes.map((value) => <button key={value} id={`schedule-tab-${value}`} type="button" role="tab" aria-selected={mode === value} aria-controls="schedule-calendar" tabIndex={mode === value ? 0 : -1} className={cn('relative min-w-14 rounded-md px-3 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-p-purple', mode === value ? 'font-semibold text-p-purple' : 'opacity-65')} onClick={() => setMode(value)}>
            {mode === value && <motion.span layoutId="schedule-active-mode" className="absolute inset-0 rounded-md border border-divider bg-background shadow-sm" transition={{ duration: reducedMotion ? 0 : 0.18 }} />}
            <span className="relative">{t(value)}</span>
          </button>)}
        </div>
        <IconButton icon="lucide:panel-right" label={t(sidebarOpen ? 'hideSidebar' : 'showSidebar')} pressed={sidebarOpen} onClick={() => setSidebarOpen((value) => !value)} />
      </div>
    </header>
    <div className="relative flex min-h-0 flex-1">
      <div id="schedule-calendar" role="tabpanel" aria-labelledby={`schedule-tab-${mode}`} className="min-h-0 min-w-0 flex-1">
        <Calendar<ScheduleItemTypes> items={allItems.filter((item) => item.type !== 'page' || pinnedIds.has(item.id))} date={date} mode={mode} locale={locale} renderers={calendarRenderers} onDateChange={setDate} onItemClick={setSelected} labels={{ calendar: t('title'), allDay: t('allDay'), more: (count) => i18n('pages.app.schedule.more', { count }) }} />
      </div>
      {sidebarOpen && <aside aria-label={t('pinnedPages')} className="absolute inset-y-0 right-0 z-10 flex w-72 shrink-0 flex-col overflow-y-auto border-l border-divider bg-background shadow-lg @min-[960px]/schedule:static @min-[960px]/schedule:shadow-none">
        <h2 className="flex min-h-11 items-center gap-1 px-3 text-xs font-semibold">{t('pinnedPages')} <span className="font-normal opacity-40">{pinnedPages.length}</span></h2>
        <div className="space-y-2 px-2 pb-3">
          {pinnedPages.sort((left, right) => left.start.localeCompare(right.start) || left.title.localeCompare(right.title)).map((item) => {
            const status = item.data.properties.find((property) => property.type === 'select')
            return <article key={item.id} data-pinned-page-card={item.id} className="relative min-w-0 rounded-lg border border-divider bg-background p-3 shadow-sm transition-colors hover:border-p-purple/30 hover:bg-contrast/40">
              <button type="button" onClick={() => { setDate(item.start.slice(0, 10)); setSelected(item) }} className="block w-full min-w-0 pr-8 text-left outline-none focus-visible:ring-2 focus-visible:ring-p-purple">
                <span className="block truncate text-xs font-semibold">{item.title}</span>
                <span className={cn('mt-1 block text-[11px]', THEME.textMuted)}>{formatCalendarDate(item.start, locale, { day: 'numeric', month: 'short', ...(!item.allDay && { hour: '2-digit', minute: '2-digit' }) })}</span>
                {status && <span className={cn('mt-2 flex min-w-0 items-center gap-1.5 text-[10px]', THEME.textMuted)}><span className={cn('size-1.5 shrink-0 rounded-full', OPTION_COLOR_SWATCH[item.color ?? 'purple'])} aria-hidden="true" /><span className="truncate">{status.value}</span></span>}
              </button>
              <button type="button" aria-pressed aria-label={i18n('pages.app.schedule.unpinNamed', { title: item.title })} title={t('unpin')} disabled={pendingPageId === item.id} onClick={() => setPendingUnpin(item)} className={cn('absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-md bg-transparent outline-none hover:bg-active hover:text-foreground focus-visible:ring-2 focus-visible:ring-p-purple disabled:opacity-45', THEME.textMuted)}>
                <Icon icon={pendingPageId === item.id ? 'lucide:loader-circle' : 'solar:pin-bold'} className={cn('size-3.5', pendingPageId === item.id && 'animate-spin')} />
              </button>
            </article>
          })}
          {!pinnedPages.length && <p className={cn('p-2 text-xs', THEME.textMuted)}>{t('noPinnedPages')}</p>}
        </div>
      </aside>}
    </div>
    <CalendarDetailsDialog<ScheduleItemTypes> item={selected} onOpenChange={(open) => { if (!open) setSelected(null) }} locale={locale} source={source} renderers={renderers} labels={{ close: t('close'), description: t('detailsDescription'), source: t('source') }}
      renderDetails={(item) => <>
        {item.type === 'page' && item.data.properties.length ? <dl className="grid gap-3">{item.data.properties.map((property) => <div key={property.id} className="grid grid-cols-[minmax(90px,0.35fr)_1fr] gap-3"><dt className={cn('text-xs', THEME.textMuted)}>{property.label}</dt><dd className="min-w-0 text-sm">{property.value}</dd></div>)}</dl> : null}
        {item.type !== 'page' ? renderers[item.type](item.data as never, item as never) : null}
        {item.type === 'page' && selectProperties.length ? <div className="mt-4"><Select label={t('colorProperty')} aria-label={t('colorProperty')} value={item.data.colorColumnId ?? selectProperties[0].id} options={selectProperties.map((property) => ({ value: property.id, label: property.label }))} onValueChange={(colorColumnId) => { void onPin(item, colorColumnId) }} /></div> : null}
      </>}
      renderActions={(item) => item.type === 'page' ? <>
        {onOpenPage ? <Button variant="text" color="from-theme" onClick={() => onOpenPage(item)}>{t('openPage')}</Button> : null}
        <Button variant="filled" color="purple" disabled={pendingPageId === item.id} onClick={() => { if (pinnedIds.has(item.id)) setPendingUnpin(item); else void onPin(item, item.data.colorColumnId) }}>
          {pendingPageId === item.id ? <Icon icon="lucide:loader-circle" className="mr-2 size-4 animate-spin" /> : <Icon icon={pinnedIds.has(item.id) ? 'solar:pin-bold' : 'lucide:pin'} className="mr-2 size-4" />}{t(pinnedIds.has(item.id) ? 'unpin' : 'pin')}
        </Button>
      </> : null}
    />
    <Modal open={Boolean(pendingUnpin)} onOpenChange={(open) => { if (!open) setPendingUnpin(null) }} size="sm" accessibleTitle={t('unpinTitle')}>
      <h2 className="text-base font-semibold">{t('unpinTitle')}</h2>
      <p className={cn('mt-2 text-sm', THEME.textMuted)}>{i18n('pages.app.schedule.unpinDescription', { title: pendingUnpin?.title })}</p>
      <div className="mt-4 flex justify-end gap-2"><Button variant="text" color="from-theme" autoFocus onClick={() => setPendingUnpin(null)}>{t('cancel')}</Button><Button variant="filled" color="purple" disabled={pendingPageId === pendingUnpin?.id} onClick={() => { if (!pendingUnpin) return; void Promise.resolve(onUnpin(pendingUnpin)).then((saved) => { if (saved !== false) setPendingUnpin(null) }) }}>{t('unpinConfirm')}</Button></div>
    </Modal>
  </section>
}

export function SchedulePage() {
  const { workspaceId } = useWorkspace()
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const schedule = useSchedule(workspaceId)
  const items = useMemo(() => schedule.pins.map(pinnedPageToCalendarItem), [schedule.pins])
  const pinnedIds = useMemo(() => new Set(schedule.pins.map((pin) => pin.pageId)), [schedule.pins])
  return <ScheduleSurface items={items} pinnedIds={pinnedIds} pendingPageId={schedule.mutating ? schedule.pendingPageId : null} onPin={(item, colorColumnId) => schedule.pin({ pageId: item.id, dateColumnId: item.data.dateColumnId, colorColumnId })} onUnpin={(item) => schedule.unpin(item.id)} onOpenPage={(item) => navigate({ to: '/$lang/page/$pageId', params: { lang, pageId: item.id }, search: {}, state: createPageNavigationState(item.id, item.title) })} />
}

export function SchedulePreviewPage() {
  const [items, setItems] = useState(() => createScheduleMock())
  const [pinnedIds, setPinnedIds] = useState(() => new Set(flatten(items).filter((item) => item.type === 'page').map((item) => item.id)))
  return <ScheduleSurface items={items} pinnedIds={pinnedIds} onPin={(item, colorColumnId) => { setPinnedIds((current) => new Set(current).add(item.id)); setItems((current) => current.map((candidate) => candidate.id === item.id && candidate.type === 'page' ? { ...candidate, color: scheduleItemColor(candidate, colorColumnId ?? undefined), data: { ...candidate.data, colorColumnId } } : candidate)) }} onUnpin={(item) => setPinnedIds((current) => { const next = new Set(current); next.delete(item.id); return next })} />
}
