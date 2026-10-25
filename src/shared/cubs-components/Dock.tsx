import { Icon } from '@iconify/react'
import { useLayoutEffect, useRef, useState } from 'react'

import { cn } from './lib/utils'

export interface DockItem {
  name: string
  icon: string
  action: () => void
  disabled?: boolean
}

export interface DockProps {
  items: DockItem[]
  more?: DockItem
  label?: string
  className?: string
}

/** Reserve a slot for More only when the available width cannot fit all items. */
export function dockVisibleCount(count: number, width: number): number {
  const slots = Math.max(1, Math.floor((Math.max(0, width - 16) + 8) / 72))
  return slots >= count ? count : Math.max(0, slots - 1)
}

/** Responsive row of equally sized actions, independent of any editor schema. */
export function Dock({ items, more, label, className }: DockProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const next = element.getBoundingClientRect().width
      if (next > 0) setWidth(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const count = more ? dockVisibleCount(items.length, width ?? 640) : items.length
  const visible = items.slice(0, count)
  const actions = count < items.length && more ? [...visible, more] : visible
  return <div ref={ref} role="toolbar" aria-label={label}
    className={cn('flex w-full justify-center', className)}>
    <div className="flex max-w-full items-end gap-2 rounded-2xl border border-foreground/5 bg-glass/60 p-2 shadow-lg shadow-dark-900/5 backdrop-blur-xl">
    {actions.map((item) => <button key={item.name} type="button" aria-label={item.name} disabled={item.disabled}
      onPointerDown={(event) => event.preventDefault()} onClick={item.action}
      className="group relative flex size-16 min-w-0 shrink items-center justify-center rounded-full outline-none disabled:pointer-events-none disabled:opacity-40">
      <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-background px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{item.name}</span>
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-p-purple/10 text-p-purple transition-transform duration-200 ease-out group-hover:-translate-y-2 group-hover:scale-125 group-focus-visible:-translate-y-2 group-focus-visible:scale-125 group-focus-visible:ring-2 group-focus-visible:ring-p-purple/40 motion-reduce:transform-none"><Icon icon={item.icon} fontSize={23} /></span>
    </button>)}
    </div>
  </div>
}
