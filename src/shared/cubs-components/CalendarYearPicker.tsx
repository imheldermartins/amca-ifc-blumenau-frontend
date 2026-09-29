import { useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'

import { Popover } from './Popover'
import { cn } from './lib/utils'

const ROW_HEIGHT = 32

function YearList({ year, label, onSelect }: { year: number; label: string; onSelect: (year: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState(Math.max(0, (year - 4) * ROW_HEIGHT))
  const [active, setActive] = useState(year)
  const first = Math.max(1, Math.floor(top / ROW_HEIGHT) - 1)
  const years = Array.from({ length: Math.min(13, 10000 - first) }, (_, index) => first + index)

  useLayoutEffect(() => {
    if (!ref.current) return
    ref.current.scrollTop = Math.max(0, (year - 4) * ROW_HEIGHT)
    ref.current.focus()
  }, [year])

  return <div ref={ref} role="listbox" aria-label={label} tabIndex={0}
    aria-activedescendant={years.includes(active) ? `calendar-year-${active}` : undefined}
    className="h-64 w-28 overflow-y-auto overscroll-contain outline-none"
    onScroll={(event) => setTop(event.currentTarget.scrollTop)}
    onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(active); return }
      const offsets: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 8, PageUp: -8 }
      if (!(event.key in offsets) && event.key !== 'Home' && event.key !== 'End') return
      event.preventDefault()
      const next = event.key === 'Home' ? 1 : event.key === 'End' ? 9999 : Math.max(1, Math.min(9999, active + offsets[event.key]))
      setActive(next)
      const element = event.currentTarget
      const y = (next - 1) * ROW_HEIGHT
      if (y < element.scrollTop || y + ROW_HEIGHT > element.scrollTop + element.clientHeight) element.scrollTop = Math.max(0, y - 3 * ROW_HEIGHT)
    }}>
    <div className="relative" style={{ height: 9999 * ROW_HEIGHT }}>
      {years.map((value) => <button key={value} id={`calendar-year-${value}`} role="option" aria-selected={value === year} tabIndex={-1} type="button"
        className={cn('absolute inset-x-1 rounded text-sm tabular-nums hover:bg-active', value === year && 'bg-p-purple/10 font-semibold text-p-purple', value === active && 'ring-1 ring-inset ring-p-purple/50')}
        style={{ top: (value - 1) * ROW_HEIGHT, height: ROW_HEIGHT }} onClick={() => onSelect(value)}>{value}</button>)}
    </div>
  </div>
}

/** Scrollable 1..9999 year control shared by calendar hosts. */
export function CalendarYearPicker({ year, onChange, chooseLabel = 'Selecionar ano', yearLabel = 'Ano' }: {
  year: number
  onChange: (year: number) => void
  chooseLabel?: string
  yearLabel?: string
}) {
  const [open, setOpen] = useState(false)
  return <Popover open={open} onOpenChange={setOpen} trigger={<button type="button" aria-label={chooseLabel}
    className="flex items-center gap-1 rounded px-1 py-1 text-lg font-medium tabular-nums hover:bg-contrast">
    {year}<Icon icon="lucide:chevron-down" className="size-3 opacity-50" />
  </button>}>
    <YearList year={year} label={yearLabel} onSelect={(value) => { onChange(value); setOpen(false) }} />
  </Popover>
}
