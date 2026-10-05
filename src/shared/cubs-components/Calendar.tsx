import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Popover } from './Popover'
import { cn } from './lib/utils'
import { OPTION_COLOR_CLASSES, type OptionColor } from './lib/optionColors'
import { calendarDate, calendarDays, flattenCalendarItems, formatCalendarDate, isLongItem, layoutDaySegments, layoutTimeSegments, shiftCalendarDate } from './calendar/layout'
import type { CalendarItem, CalendarProps, CalendarRenderers, mappedItemsTypes } from './calendar/types'

const defaultLabels = { calendar: 'Calendário', allDay: 'Dia inteiro', more: (count: number) => `+${count} itens` }
const itemClass = 'block min-w-0 overflow-hidden rounded-sm border px-1.5 pb-1 text-left text-[11px] leading-5 shadow-sm backdrop-blur-sm outline-none transition-[filter,box-shadow] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-p-purple'
const calendarItemSurfaceClasses: Record<OptionColor, string> = {
  red: 'border-p-red-600/40 shadow-p-red-600/20 dark:border-p-red-500/40 dark:shadow-p-red-500/20',
  pink: 'border-p-pink-600/40 shadow-p-pink-600/20 dark:border-p-pink-500/40 dark:shadow-p-pink-500/20',
  orange: 'border-p-orange-600/40 shadow-p-orange-600/20 dark:border-p-orange-500/40 dark:shadow-p-orange-500/20',
  yellow: 'border-p-yellow-600/40 shadow-p-yellow-600/20 dark:border-p-yellow-500/40 dark:shadow-p-yellow-500/20',
  green: 'border-p-green-600/40 shadow-p-green-600/20 dark:border-p-green-500/40 dark:shadow-p-green-500/20',
  blue: 'border-p-blue-600/40 shadow-p-blue-600/20 dark:border-p-blue-500/40 dark:shadow-p-blue-500/20',
  purple: 'border-p-purple-600/40 shadow-p-purple-600/20 dark:border-p-purple-500/40 dark:shadow-p-purple-500/20',
  grey: 'border-p-grey-600/40 shadow-p-grey-600/20 dark:border-p-grey-500/40 dark:shadow-p-grey-500/20',
}

export function CalendarItemContent<M extends object = mappedItemsTypes>({ item, renderers }: {
  item: CalendarItem<M>
  renderers?: CalendarRenderers<M>
}) {
  // The discriminated union guarantees that the selected renderer owns this payload.
  const render = renderers?.[item.type] as ((data: M[keyof M], item: CalendarItem<M>) => ReactNode) | undefined
  return <>{render ? render(item.data, item) : <span className="font-medium">{item.title}</span>}</>
}

function EventBar<M extends object>({ item, renderers, onItemClick, style, className }: {
  item: CalendarItem<M>
  renderers?: CalendarRenderers<M>
  onItemClick?: (item: CalendarItem<M>) => void
  style?: CSSProperties
  className?: string
}) {
  const color = item.color ?? 'purple'
  return <button
    type="button"
    data-calendar-item={item.id}
    aria-label={item.title}
    title={item.title}
    onClick={() => onItemClick?.(item)}
    className={cn(itemClass, OPTION_COLOR_CLASSES[color], calendarItemSurfaceClasses[color], className)}
    style={style}
  >
    <CalendarItemContent item={item} renderers={renderers} />
  </button>
}

function MonthWeek<M extends object>({ days, date, items, onDateChange, onItemClick, renderers, locale, labels, monthItemHeight = 20, dayCounts, renderDayOverflow }: CalendarProps<M> & { days: string[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(126)
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height))
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  const segments = layoutDaySegments(items, days)
  const itemHeight = Math.max(20, monthItemHeight)
  // 32px do cabeçalho do dia + 2px de respiro mínimo. O host pode aumentar
  // a altura do chart; o indicador de overflow continua ancorado no rodapé.
  const laneCount = Math.max(0, Math.floor((height - 34) / (itemHeight + 4)))
  const today = new Date().toLocaleDateString('en-CA')
  return <div ref={ref} className="relative min-h-0 border-b border-divider last:border-b-0">
    <div className="absolute inset-0 grid grid-cols-7">
      {days.map((day) => <div key={day} data-calendar-today={day === today ? '' : undefined}
        className={cn('min-w-0 border-r border-divider last:border-r-0',
          day === today && 'bg-p-purple/5 dark:bg-p-purple/10',
          day !== today && calendarDate(day).month() !== calendarDate(date).month() && 'bg-contrast/45')}>
        <button type="button" aria-label={formatCalendarDate(day, locale ?? 'pt-BR', { dateStyle: 'full' })}
          aria-pressed={day === date.slice(0, 10)}
          onClick={() => onDateChange?.(day)}
          className={cn('m-1 flex size-6 items-center justify-center rounded-full text-xs tabular-nums outline-none hover:bg-active focus-visible:ring-2 focus-visible:ring-p-purple',
            day === today && 'bg-p-purple font-semibold text-white hover:bg-p-purple',
            day !== today && day === date.slice(0, 10) && 'bg-p-purple/10 font-semibold text-p-purple',
            calendarDate(day).month() !== calendarDate(date).month() && 'opacity-40')}>
          {calendarDate(day).date()}
        </button>
      </div>)}
    </div>
    <div className="pointer-events-none relative grid grid-cols-7 gap-y-1 pt-8" style={{ gridAutoRows: itemHeight }}>
      {segments.filter((segment) => segment.lane < laneCount).map((segment) => <EventBar
        key={segment.item.id} item={segment.item} renderers={renderers} onItemClick={onItemClick}
        className={cn('pointer-events-auto mx-0.5', segment.continuesBefore && 'rounded-l-none', segment.continuesAfter && 'rounded-r-none')}
        style={{ gridColumn: `${segment.column + 1} / span ${segment.span}`, gridRow: segment.lane + 1 }}
      />)}
    </div>
    <div className="pointer-events-none absolute inset-x-0 bottom-0.5 grid grid-cols-7">
      {days.map((day, index) => {
        const hidden = segments.filter((segment) => segment.lane >= laneCount && segment.column <= index && segment.column + segment.span > index)
        const shown = segments.filter((segment) => segment.lane < laneCount && segment.column <= index && segment.column + segment.span > index).length
        const hiddenCount = dayCounts?.[day] === undefined ? hidden.length : Math.max(0, dayCounts[day] - shown)
        if (!hiddenCount) return <span key={day} />
        return <Popover key={day} trigger={<button type="button" className="pointer-events-auto mx-1 truncate rounded text-left text-[10px] opacity-65 hover:bg-active">{(labels?.more ?? defaultLabels.more)(hiddenCount)}</button>}>
          {renderDayOverflow ? renderDayOverflow(day, hidden.map((segment) => segment.item)) :
          <div data-calendar-scroll className="max-h-72 w-64 space-y-1 overflow-y-auto p-2">
            <p className="mb-2 text-xs font-semibold">{formatCalendarDate(day, locale ?? 'pt-BR', { dateStyle: 'long' })}</p>
            {hidden.map(({ item }) => <EventBar key={item.id} item={item} renderers={renderers} onItemClick={onItemClick} className="w-full" />)}
          </div>}
        </Popover>
      })}
    </div>
  </div>
}

function TimeGrid<M extends object>(props: CalendarProps<M> & { days: string[] }) {
  const { days, items, locale = 'pt-BR', onDateChange, onItemClick, renderers, labels } = props
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 7 * 60 }, [])
  const longItems = items.filter(isLongItem)
  const timedItems = items.filter((item) => !isLongItem(item))
  const bars = layoutDaySegments(longItems, days)
  const columns = `48px repeat(${days.length}, minmax(0, 1fr))`
  const today = new Date().toLocaleDateString('en-CA')
  return <div ref={scroller} data-calendar-scroll className="h-full min-h-0 overflow-y-auto overscroll-contain">
    <div className="sticky top-0 z-10 bg-background">
    <div className="grid shrink-0 border-b border-divider" style={{ gridTemplateColumns: columns }}>
      <span />
      {days.map((day) => <button key={day} type="button" onClick={() => onDateChange?.(day)}
        className={cn('border-l border-divider py-2 text-center outline-none hover:bg-contrast focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-p-purple', day === today && 'bg-p-purple/5 dark:bg-p-purple/10')}
        aria-label={formatCalendarDate(day, locale, { dateStyle: 'full' })}>
        <span className="block text-[10px] uppercase opacity-55">{formatCalendarDate(day, locale, { weekday: 'narrow' })}</span>
        <span className={cn('mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold', day === today && 'bg-p-purple text-white')}>{calendarDate(day).date()}</span>
      </button>)}
    </div>
    <div className="flex max-h-32 shrink-0 overflow-y-auto border-b border-divider" data-calendar-scroll>
      <span className="w-12 shrink-0 px-1 py-2 text-center text-[9px] opacity-55">{labels?.allDay ?? defaultLabels.allDay}</span>
      <div className="grid min-h-8 flex-1 gap-y-1 border-l border-divider py-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gridAutoRows: 22 }}>
        {bars.map((bar) => <EventBar key={bar.item.id} item={bar.item} renderers={renderers} onItemClick={onItemClick}
          className={cn('mx-0.5', bar.continuesBefore && 'rounded-l-none', bar.continuesAfter && 'rounded-r-none')}
          style={{ gridColumn: `${bar.column + 1} / span ${bar.span}`, gridRow: bar.lane + 1 }} />)}
      </div>
    </div>
    </div>
      <div className="relative grid" style={{ height: 1440, gridTemplateColumns: columns }}>
        <div className="relative">
          {Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-2 text-[10px] tabular-nums opacity-50" style={{ top: hour * 60 + 2 }}>{String(hour).padStart(2, '0')}:00</span>)}
        </div>
        {days.map((day) => <div key={day} data-calendar-today={day === today ? '' : undefined}
          className={cn('relative border-l border-divider', day === today && 'bg-p-purple/5 dark:bg-p-purple/10')}>
          {Array.from({ length: 24 }, (_, hour) => <div key={hour} className="absolute inset-x-0 border-t border-divider" style={{ top: hour * 60 }}><div className="mt-[30px] border-t border-divider/40" /></div>)}
          {layoutTimeSegments(timedItems, day).map((segment) => <EventBar key={segment.item.id}
            item={segment.item} renderers={renderers} onItemClick={onItemClick} className="absolute flex flex-col py-1 [&_[data-calendar-title]]:line-clamp-3 [&_[data-calendar-title]]:whitespace-normal [&_[data-calendar-title]]:break-words [&_[data-calendar-title]]:leading-tight"
            style={{ top: segment.startMinute, height: Math.max(18, segment.endMinute - segment.startMinute - 2), left: `calc(${segment.column / segment.columnCount * 100}% + 2px)`, width: `calc(${100 / segment.columnCount}% - 4px)` }} />)}
        </div>)}
      </div>
  </div>
}

/** Controlled calendar surface. Toolbars, persistence and source selection belong to the host. */
export function Calendar<M extends object = mappedItemsTypes>({ mode = 'month', locale = 'pt-BR', weekStartsOn = 0, ...props }: CalendarProps<M>) {
  const { date, items, onDateChange, className } = props
  const root = useRef<HTMLDivElement>(null)
  const gesture = useRef({ delta: 0, last: 0, locked: false })
  const touchStart = useRef<number | null>(null)
  const reducedMotion = useReducedMotion()
  const days = calendarDays(date, mode, weekStartsOn)
  const flatItems = useMemo(() => flattenCalendarItems(items), [items])
  const periodKey = `${mode}:${mode === 'month' ? date.slice(0, 7) : days[0]}`

  useEffect(() => {
    const element = root.current
    if (!element || mode !== 'month' || !onDateChange) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || (event.target as Element).closest('[data-calendar-scroll]')) return
      event.preventDefault()
      const now = performance.now()
      const state = gesture.current
      if (now - state.last > 180) { state.delta = 0; state.locked = false }
      state.last = now
      if (state.locked) return
      state.delta += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1)
      if (Math.abs(state.delta) < 60) return
      state.locked = true
      onDateChange(shiftCalendarDate(date, Math.sign(state.delta), 'month'))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [date, mode, onDateChange])

  return <div ref={root} data-calendar-mode={mode} role="region" aria-label={props.labels?.calendar ?? defaultLabels.calendar}
    tabIndex={0} className={cn('relative h-full min-h-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-p-purple', className)}
    style={mode === 'month' ? { touchAction: 'pan-x pinch-zoom' } : undefined}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || !onDateChange || !['PageDown', 'PageUp'].includes(event.key)) return
      event.preventDefault()
      onDateChange(shiftCalendarDate(date, event.key === 'PageDown' ? 1 : -1, mode))
    }}
    onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null }}
    onTouchEnd={(event) => {
      if (mode !== 'month' || touchStart.current === null || !onDateChange) return
      const delta = touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current)
      if (Math.abs(delta) > 60) onDateChange(shiftCalendarDate(date, Math.sign(delta), 'month'))
      touchStart.current = null
    }}>
    <AnimatePresence initial={false} mode="wait">
      <motion.div key={periodKey} className="flex h-full min-h-0 flex-col"
        initial={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 12 }}
        animate={{ opacity: 1, y: 0 }} exit={{ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : -8 }}
        transition={{ duration: reducedMotion ? 0 : 0.16, ease: 'easeOut' }}>
        {mode === 'month' ? <>
          <div className="grid shrink-0 grid-cols-7 border-b border-divider">
            {days.slice(0, 7).map((day) => <span key={day} title={formatCalendarDate(day, locale, { weekday: 'long' })} className="py-2 text-center text-[10px] font-medium uppercase tracking-wider opacity-50">{formatCalendarDate(day, locale, { weekday: 'narrow' })}</span>)}
          </div>
          <div className="grid min-h-0 flex-1" style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}>
            {Array.from({ length: days.length / 7 }, (_, index) => <MonthWeek key={days[index * 7]} {...props} mode={mode} locale={locale} days={days.slice(index * 7, index * 7 + 7)} items={flatItems} />)}
          </div>
        </> : <TimeGrid {...props} locale={locale} mode={mode} days={days} items={flatItems} />}
      </motion.div>
    </AnimatePresence>
  </div>
}
