import { Icon } from '@iconify/react'
import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'

import { cn } from './lib/utils'
import { useMediaQuery } from './lib/useMediaQuery'

export interface DockItem {
  name: string
  icon: string
  action: () => void
  disabled?: boolean
  separatorBefore?: boolean
}

export interface DockProps {
  items: DockItem[]
  more?: DockItem
  label?: string
  className?: string
}

/** Reserve a slot for More only when the available width cannot fit all items. */
export function dockVisibleCount(count: number, width: number, separators: number[] = []): number {
  const fits = (visible: number, more: boolean) => (visible + Number(more)) * 44 + 8 + separators.filter((index) => index > 0 && index < visible).length * 13 <= width
  if (fits(count, false)) return count
  for (let visible = count - 1; visible > 0; visible--) if (fits(visible, true)) return visible
  return 0
}

function DockAction({ item, mouseX, animated }: { item: DockItem; mouseX: MotionValue<number>; animated: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const focused = useMotionValue(0)
  const proximity = useTransform([mouseX, focused], ([position, focus]: number[]) => {
    if (!animated || item.disabled) return 0
    const rect = ref.current?.getBoundingClientRect()
    const distance = rect && Number.isFinite(position) ? Math.abs(position! - rect.left - rect.width / 2) : Infinity
    return Math.max(focus!, Math.max(0, 1 - distance / 100))
  })
  const spring = useSpring(proximity, { stiffness: 350, damping: 28, mass: 0.4 })
  const scale = useTransform(spring, [0, 1], [1, 1.4])
  const y = useTransform(spring, [0, 1], [0, -8])
  return <button ref={ref} type="button" aria-label={item.name} disabled={item.disabled}
    onFocus={() => focused.set(1)} onBlur={() => focused.set(0)}
    onPointerDown={(event) => event.preventDefault()} onClick={item.action}
    className="group relative flex size-10 min-w-0 shrink-0 items-center justify-center rounded-lg outline-none disabled:pointer-events-none disabled:opacity-40">
    <span className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-background px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{item.name}</span>
    <motion.span data-dock-icon style={{ scale: animated ? scale : 1, y: animated ? y : 0 }}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-p-purple/10 text-p-purple group-focus-visible:ring-2 group-focus-visible:ring-p-purple/40"><Icon icon={item.icon} fontSize={18} /></motion.span>
  </button>
}

/** Responsive row of equally sized actions, independent of any editor schema. */
export function Dock({ items, more, label, className }: DockProps) {
  const desktop = useMediaQuery('(min-width: 768px) and (hover: hover) and (pointer: fine)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const animated = desktop && !reducedMotion
  const mouseX = useMotionValue(Infinity)
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
  const count = more ? dockVisibleCount(items.length, width ?? 640, items.flatMap((item, index) => item.separatorBefore ? [index] : [])) : items.length
  const visible = items.slice(0, count)
  const actions = count < items.length && more ? [...visible, more] : visible
  return <div ref={ref} role="toolbar" aria-label={label} data-dock-animation={animated ? 'proximity' : 'none'}
    onPointerMove={(event) => { if (animated && event.pointerType !== 'touch') mouseX.set(event.clientX) }} onPointerLeave={() => mouseX.set(Infinity)}
    className={cn('flex w-full justify-center', className)}>
    <div className="flex max-w-full items-center gap-1 rounded-xl border border-foreground/5 bg-glass/60 p-1.5 shadow-md shadow-dark-900/5 backdrop-blur-xl">
    {actions.map((item, index) => <Fragment key={item.name}>
    {item.separatorBefore && index > 0 && <span role="separator" aria-orientation="vertical" className="mx-1 h-6 shrink-0 self-center border-l border-divider" />}
    <DockAction item={item} mouseX={mouseX} animated={animated} /></Fragment>)}
    </div>
  </div>
}
