import { cn } from 'cubs-components'
import { useMemo, useState } from 'react'

import type { DatabasePagination } from '../pagination'
import { pageViewScopeKey, type PageViewQueryScope } from '../pageViewQueryContract'
import type { HeatmapConfig, HeaderCol, RowData } from '../types'
import { heatmapDayKey as dayKey, heatmapDate as utcDate, heatmapIntensity, heatmapWeeklyMaxima, heatmapRuleDescription, type HeatmapDay as DayValue } from '../heatmap'

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const
const DAY_MS = 86_400_000
const shift = (date: Date, amount: number) => new Date(date.getTime() + amount * DAY_MS)
const monthTitle = (date: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
const dayTitle = (date: Date) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(date)

function DaySquare({ date, value, maximum, selected, showNumber, onSelect }: {
  date: Date
  value: DayValue
  maximum: number
  selected: boolean
  showNumber?: boolean
  onSelect: () => void
}) {
  const intensity = heatmapIntensity(value.checked, maximum)
  const percentage = Math.round(intensity * 100)
  const description = `${dayTitle(date)}: ${value.checked} marcadas em ${value.total} páginas, máximo semanal ${maximum}, intensidade ${percentage}%`
  return <button type="button" onClick={onSelect}
    aria-label={description}
    aria-pressed={selected}
    title={description}
    className={cn('aspect-square min-h-3 min-w-3 rounded-[4px] border transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-p-purple',
      intensity === 0 ? 'border-divider bg-foreground/5' : 'border-p-purple-500/25',
      selected && 'ring-2 ring-p-purple ring-offset-1 ring-offset-background')}
    style={intensity === 0 ? undefined : { backgroundColor: `color-mix(in srgb, var(--color-p-purple-500) ${intensity * 100}%, color-mix(in srgb, var(--color-foreground) 5%, transparent))` }}>
    {showNumber ? <span className={cn('text-[10px] font-medium', percentage >= 55 ? 'text-white' : 'text-foreground')}>{date.getUTCDate()}</span> : null}
  </button>
}

function MonthlyHeatmap({ days, maxima, selected, onSelect }: { days: Record<string, DayValue>; maxima: Record<string, number>; selected: string | null; onSelect: (key: string) => void }) {
  const months = useMemo(() => {
    const keys = Object.keys(days).sort()
    if (!keys.length) return []
    const first = utcDate(keys[0]!)
    const last = utcDate(keys.at(-1)!)
    const result: Date[] = []
    for (let current = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1)); current <= last; current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1))) result.push(current)
    return result
  }, [days])
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
    {months.map((month) => {
      const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
      const cells = [...Array(month.getUTCDay()).fill(null), ...Array.from({ length: lastDay }, (_, index) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), index + 1)))]
      return <section key={dayKey(month)}>
        <h3 className="mb-3 text-sm font-semibold capitalize">{monthTitle(month)}</h3>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] opacity-60">{WEEKDAYS.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}</div>
        <div className="grid grid-cols-7 gap-1">{cells.map((date, index) => date
          ? <DaySquare key={dayKey(date)} date={date} value={days[dayKey(date)] ?? { total: 0, checked: 0 }} maximum={maxima[dayKey(date)] ?? 0} selected={selected === dayKey(date)} showNumber onSelect={() => onSelect(dayKey(date))} />
          : <span key={`blank-${index}`} />)}</div>
      </section>
    })}
  </div>
}

function YearHeatmap({ days, maxima, selected, onSelect }: { days: Record<string, DayValue>; maxima: Record<string, number>; selected: string | null; onSelect: (key: string) => void }) {
  const weeks = useMemo(() => {
    const keys = Object.keys(days).sort()
    if (!keys.length) return []
    const first = utcDate(keys[0]!), last = utcDate(keys.at(-1)!)
    const start = shift(first, -first.getUTCDay()), end = shift(last, 6 - last.getUTCDay())
    const result: Date[][] = []
    for (let cursor = start; cursor <= end; cursor = shift(cursor, 7)) result.push(Array.from({ length: 7 }, (_, index) => shift(cursor, index)))
    return result
  }, [days])
  return <div className="min-w-0 overflow-x-auto pb-2">
    <div className="grid w-full grid-cols-[2rem_minmax(0,1fr)] gap-2" style={{ minWidth: 40 + weeks.length * 12 + Math.max(0, weeks.length - 1) * 4 }}>
      <div className="grid grid-rows-7 gap-1 text-[10px] opacity-60">{WEEKDAYS.map((label, index) => <span key={`${label}-${index}`} className="flex items-center">{label}</span>)}</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(12px, 1fr))` }}>{weeks.map((week) => <div key={dayKey(week[0]!)} className="grid grid-rows-7 gap-1">
        {week.map((date) => {
          const key = dayKey(date), value = days[key]
          return value ? <DaySquare key={key} date={date} value={value} maximum={maxima[key] ?? 0} selected={selected === key} onSelect={() => onSelect(key)} />
            : <span key={key} className="aspect-square rounded-[4px]" />
        })}
      </div>)}</div>
    </div>
  </div>
}

export function HeatmapView({ config, pagination, columns, onOpenRow }: {
  config?: HeatmapConfig
  pagination?: DatabasePagination
  columns: HeaderCol[]
  onOpenRow?: (row: RowData) => void
}) {
  const days = pagination?.projection?.heatmapDays ?? {}
  const keys = Object.keys(days).sort()
  const maxima = useMemo(() => heatmapWeeklyMaxima(days), [days])
  const identity = JSON.stringify([pagination?.projection?.pageId, pagination?.projection?.viewId, pagination?.projection?.queryKey, config, keys[0], keys.at(-1)])
  const [selection, setSelection] = useState<{ identity: string; day: string } | null>(null)
  const selected = selection?.identity === identity ? selection.day : null
  const from = keys[0], to = keys.at(-1)
  const scope: PageViewQueryScope | null = selected && from && to ? { type: 'heatmap', from, to, day: selected } : null
  const stream = scope ? pagination?.streams[pageViewScopeKey(scope)] : undefined
  const titleColumn = columns.find((column) => column.key === 'title')
  const choose = (key: string) => {
    setSelection({ identity, day: key })
    if (from && to) pagination?.setScope({ type: 'heatmap', from, to, day: key })
  }
  if (!config || !from || !to) return <p className="px-4 py-8 text-center text-sm opacity-60">Nenhum dia disponível para este período.</p>
  return <div className="grid min-w-0 gap-5 px-4">
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs opacity-70">
      <span>{heatmapRuleDescription(config, columns)}</span>
      {pagination?.projection?.ignoredRanges ? <span>{pagination.projection.ignoredRanges} intervalos ignorados</span> : null}
    </div>
    {config.period.mode === 'year'
      ? <YearHeatmap days={days} maxima={maxima} selected={selected} onSelect={choose} />
      : <MonthlyHeatmap days={days} maxima={maxima} selected={selected} onSelect={choose} />}
    {selected ? <section className="rounded-xl border border-divider p-3">
      <h3 className="mb-2 text-sm font-semibold capitalize">{dayTitle(utcDate(selected))}</h3>
      {stream?.error ? <div role="alert" className="text-sm">
        <p>Não foi possível carregar as páginas deste dia.</p>
        <button type="button" onClick={() => scope && pagination?.retry?.(scope)} className="mt-1 text-p-purple">Tentar novamente</button>
      </div> : null}
      {!stream || (stream.isFetching && !stream.rows.length) ? <p className="text-sm opacity-60">Carregando páginas…</p>
        : stream.rows.length ? <div className="grid gap-1">{stream.rows.map((row) => <button key={row.id} type="button" onClick={() => onOpenRow?.(row)} className="rounded px-2 py-1.5 text-left text-sm hover:bg-active">
          <DatabaseMentionText value={String(row.cells[titleColumn?.id ?? 'page_title']?.value || 'Sem título')} />
        </button>)}
          {stream.hasNextPage && scope ? <button type="button" disabled={stream.isFetching} onClick={() => pagination?.loadNext(scope)}
            className="mt-1 rounded px-2 py-2 text-center text-xs font-medium text-p-purple hover:bg-active">
            {stream.isFetching ? 'Carregando páginas…' : 'Carregar mais'}
          </button> : null}
        </div>
          : !stream.error ? <p className="text-sm opacity-60">Nenhuma página neste dia.</p> : null}
    </section> : null}
  </div>
}
import { DatabaseMentionText } from '../mentions'
