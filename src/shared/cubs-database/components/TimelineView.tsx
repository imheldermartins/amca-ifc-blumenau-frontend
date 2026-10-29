import { useEffect, useMemo, useRef, useState } from 'react'
import { cn, formatDatePickerValue, OPTION_COLOR_CLASSES, type OptionColor } from 'cubs-components'
import type { HeaderCol, RowData } from '../types'
import type { DatabasePagination } from '../pagination'
import { pageViewScopeKey, type PageViewQueryScope } from '../pageViewQueryContract'
import { timelineBar, timelineItems, timelinePeriod, type TimelineScale } from '../timeline'
import { DatabaseMentionText } from '../mentions'
import { VirtualInfiniteList } from './VirtualInfiniteList'

export interface TimelineViewProps {
  rows: RowData[]
  columns: HeaderCol[]
  dateColumnId?: string
  colorColumnId?: string | null
  pagination?: DatabasePagination
  onEditRow?: (row: RowData, dateColumnId: string) => void
  onOpenRow?: (row: RowData) => void
}
const EMPTY_ROWS: RowData[] = []
const itemKey = (item: {id: string}) => item.id
const buttonClass = 'rounded-md px-2.5 py-1.5 text-xs hover:bg-contrast focus-visible:outline-2 focus-visible:outline-p-purple'

export function TimelineView({ rows, columns, dateColumnId, colorColumnId, pagination, onEditRow, onOpenRow }: TimelineViewProps) {
  const effectiveDateColumnId = dateColumnId ?? pagination?.projection?.dateColumnId
  const dateColumn = effectiveDateColumnId ? columns.find(c => c.id === effectiveDateColumnId && c.type === 'date') : columns.find(c => c.type === 'date')
  const [scale, setScale] = useState<TimelineScale>('month')
  const [requestedDate, setDate] = useState<string | null>(null)
  const initialDate = useMemo(() => timelineItems(rows, columns, dateColumn?.id, colorColumnId)[0]?.start.slice(0, 10), [rows, columns, dateColumn?.id, colorColumnId])
  const today = new Date().toLocaleDateString('en-CA')
  const date = requestedDate ?? pagination?.projection?.initialDate ?? initialDate ?? today
  const period = useMemo(() => timelinePeriod(date, scale), [date, scale])
  const scope = useMemo<PageViewQueryScope>(() => ({type: 'calendar', from: period.from, to: period.to}), [period])
  const setScope = pagination?.setScope
  const ready = Boolean(pagination?.projection)
  useEffect(() => { if (ready && dateColumn) setScope?.(scope) }, [ready, dateColumn?.id, scope, setScope])
  const stream = pagination?.streams[pageViewScopeKey(scope)]
  const sourceRows = pagination ? stream?.rows ?? EMPTY_ROWS : rows
  const items = useMemo(() => timelineItems(sourceRows, columns, dateColumn?.id, colorColumnId), [sourceRows, columns, dateColumn?.id, colorColumnId])
  const headerRef = useRef<HTMLDivElement>(null)
  const syncHeader = (event: {currentTarget: HTMLDivElement}) => { if (headerRef.current) headerRef.current.scrollLeft = event.currentTarget.scrollLeft }
  const dayWidth = scale === 'week' ? 100 : 40
  const width = 200 + period.days.length * dayWidth
  const visibleItems = items.filter(item => timelineBar(item.startMs, item.endMs, period, dayWidth))
  const shift = (direction: number) => {
    const next = new Date(period.start)
    if (scale === 'month') next.setUTCMonth(next.getUTCMonth() + direction)
    else next.setUTCDate(next.getUTCDate() + direction * 7)
    setDate(next.toISOString().slice(0, 10))
  }
  const todayIndex = period.days.indexOf(today)
  const gridStyle = { backgroundImage: 'linear-gradient(to right, var(--color-divider) 1px, transparent 1px)', backgroundSize: `${dayWidth}px 100%` }
  const renderItem = (item: typeof items[number]) => {
    const bar = timelineBar(item.startMs, item.endMs, period, dayWidth)!
    const row = sourceRows.find(row => row.id === item.id)!
    const open = () => { if (onEditRow && dateColumn) onEditRow(row, dateColumn.id); else onOpenRow?.(row) }
    const description = formatDatePickerValue(row.cells[dateColumn!.id]?.value)
    return <div className="flex h-12 border-b border-divider" data-timeline-row={item.id}>
      <button type="button" onClick={open} className="sticky left-0 z-10 w-[200px] shrink-0 truncate border-r border-divider bg-background px-3 text-left text-sm hover:bg-contrast focus-visible:outline-2 focus-visible:outline-p-purple" title={item.title}><DatabaseMentionText value={item.title} /></button>
      <div className="relative flex-1" style={gridStyle}>
        {todayIndex >= 0 && <span aria-hidden className="pointer-events-none absolute inset-y-0 border-l border-p-purple" style={{left: todayIndex * dayWidth}} />}
        <button type="button" aria-label={`Editar ${item.title}`} title={`${item.title}: ${description}`} onClick={open} data-timeline-bar data-color={item.color}
          style={{left: bar.left, width: bar.width}} className={cn('absolute top-2 h-8 overflow-hidden rounded border border-current/20 px-2 text-left text-xs font-medium focus-visible:outline-2 focus-visible:outline-p-purple', OPTION_COLOR_CLASSES[item.color as OptionColor] ?? OPTION_COLOR_CLASSES.purple)}>
          <span className="block truncate"><DatabaseMentionText value={item.title} /></span>
        </button>
      </div>
    </div>
  }
  return <section data-database-timeline aria-label="Cronograma" aria-busy={pagination?.loading || undefined}>
    <header className="flex flex-wrap items-center gap-1 border-y border-divider px-3 py-2">
      <h2 className="mr-auto text-sm font-semibold capitalize" aria-live="polite">{new Date(period.start).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric', timeZone: 'UTC'})}</h2>
      <button type="button" className={buttonClass} onClick={() => shift(-1)} aria-label="Período anterior">←</button>
      <button type="button" className={buttonClass} onClick={() => setDate(today)}>Hoje</button>
      <button type="button" className={buttonClass} onClick={() => shift(1)} aria-label="Próximo período">→</button>
      <div role="group" aria-label="Escala">{(['week', 'month'] as const).map(value => <button key={value} type="button" aria-pressed={scale === value} className={cn(buttonClass, scale === value && 'bg-p-purple/10 text-p-purple')} onClick={() => setScale(value)}>{value === 'week' ? 'Semana' : 'Mês'}</button>)}</div>
    </header>
    {!dateColumn ? <p className="p-10 text-center text-sm opacity-70">Adicione uma propriedade de data ou selecione uma nas configurações desta view.</p> : <div>
      <div ref={headerRef} className="overflow-hidden">
      <div style={{width, minWidth: '100%'}}>
        <div className="flex h-12 border-b border-divider text-xs">
          <span className="sticky left-0 z-20 flex w-[200px] shrink-0 items-center border-r border-divider bg-background px-3 font-medium">Página</span>
          {period.days.map(day => <span key={day} style={{width: dayWidth}} className={cn('flex shrink-0 flex-col items-center justify-center border-r border-divider', day === today && 'bg-p-purple/10 font-semibold text-p-purple')}><span>{new Date(`${day}T00:00:00Z`).toLocaleDateString('pt-BR', {weekday: 'short', timeZone: 'UTC'})}</span>{Number(day.slice(-2))}</span>)}
        </div>
      </div></div>
        {pagination?.error && !stream?.error ? <button type="button" className="px-3 py-2 text-xs text-p-red" onClick={() => pagination.retry?.(scope)}>Não foi possível carregar. Tentar novamente</button> : null}
        {pagination ? <VirtualInfiniteList items={visibleItems} itemKey={itemKey} renderItem={renderItem} pagination={pagination} scope={scope} stream={stream} estimateSize={48} contentWidth={width} onScroll={syncHeader} /> : <div className="max-h-[65dvh] overflow-auto" onScroll={syncHeader}><div style={{minWidth: width}}>{visibleItems.map(item => <div key={item.id}>{renderItem(item)}</div>)}</div></div>}
      {!(pagination?.loading || stream?.isFetching || pagination?.error || stream?.error) && !visibleItems.length && <p className="sticky left-0 w-fit p-6 text-sm opacity-70">Nenhuma página com data neste período.</p>}
    </div>}
  </section>
}
