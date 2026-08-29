import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject, UIEvent } from 'react'
import { cn } from 'cubs-components'

import { CUBS_SCROLLBAR_CLASS_NAME } from './scrollbarStyles'

export interface VirtualScrollerProps {
  /** Scroll horizontal real da tabela. */
  scrollViewportRef: RefObject<HTMLDivElement | null>
  /** Conteúdo cuja largura determina o curso do scroll. */
  contentRef: RefObject<HTMLDivElement | null>
  /** Mantém overlays da tabela alinhados quando o proxy é arrastado. */
  onScrollLeftChange?: (scrollLeft: number) => void
  className?: string
}

interface ScrollerMetrics {
  visible: boolean
  left: number
  width: number
  bottom: number
  contentWidth: number
}

const EMPTY_METRICS: ScrollerMetrics = {
  visible: false,
  left: 0,
  width: 0,
  bottom: 0,
  contentWidth: 0,
}

const METRIC_TOLERANCE = 1

function metricsAreEqual(left: ScrollerMetrics, right: ScrollerMetrics) {
  return (
    left.visible === right.visible &&
    Math.abs(left.left - right.left) < METRIC_TOLERANCE &&
    Math.abs(left.width - right.width) < METRIC_TOLERANCE &&
    Math.abs(left.bottom - right.bottom) < METRIC_TOLERANCE &&
    Math.abs(left.contentWidth - right.contentWidth) < METRIC_TOLERANCE
  )
}

/**
 * A barra é `fixed`, mas precisa respeitar a borda inferior de qualquer
 * ancestral que recorte a tabela (no app, o `<main>`). Assim ela nunca vaza
 * sobre outros painéis da interface.
 */
function visibleViewportBottom(element: HTMLElement) {
  let bottom = window.innerHeight
  let parent = element.parentElement

  while (parent) {
    const overflowY = window.getComputedStyle(parent).overflowY
    if (/(auto|scroll|hidden|clip)/.test(overflowY)) {
      bottom = Math.min(bottom, parent.getBoundingClientRect().bottom)
    }
    parent = parent.parentElement
  }

  return bottom
}

/**
 * Scroll horizontal flutuante e sincronizado. Ele só existe enquanto:
 *
 * - há overflow horizontal de verdade;
 * - alguma parte da tabela está visível;
 * - a barra real, no fim natural da tabela, ainda está abaixo da viewport.
 *
 * Isso preserva o scroll vertical da página e elimina a necessidade de
 * inventar um `max-height` para manter a navegação horizontal alcançável.
 */
export function VirtualScroller({
  scrollViewportRef,
  contentRef,
  onScrollLeftChange,
  className,
}: VirtualScrollerProps) {
  const virtualScrollerRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState(EMPTY_METRICS)

  const measure = useCallback(() => {
    const viewport = scrollViewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const rect = viewport.getBoundingClientRect()
    const viewportBottom = visibleViewportBottom(viewport)
    const contentWidth = Math.max(viewport.scrollWidth, content.scrollWidth, content.offsetWidth)
    const hasHorizontalOverflow = contentWidth - viewport.clientWidth > METRIC_TOLERANCE
    const overlapsVisibleArea = rect.top < viewportBottom && rect.bottom > 0
    const realScrollerIsBelowViewport = rect.bottom - viewportBottom > METRIC_TOLERANCE
    const next: ScrollerMetrics = {
      visible: hasHorizontalOverflow && overlapsVisibleArea && realScrollerIsBelowViewport,
      left: rect.left,
      width: rect.width,
      bottom: Math.max(0, window.innerHeight - viewportBottom),
      contentWidth,
    }

    setMetrics((current) => (metricsAreEqual(current, next) ? current : next))

    const virtualScroller = virtualScrollerRef.current
    if (virtualScroller && virtualScroller.scrollLeft !== viewport.scrollLeft) {
      virtualScroller.scrollLeft = viewport.scrollLeft
    }
  }, [contentRef, scrollViewportRef])

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    let frame: number | null = null
    const scheduleMeasure = () => {
      if (frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        measure()
      })
    }

    const handleViewportScroll = () => {
      const virtualScroller = virtualScrollerRef.current
      if (virtualScroller && virtualScroller.scrollLeft !== viewport.scrollLeft) {
        virtualScroller.scrollLeft = viewport.scrollLeft
      }
      onScrollLeftChange?.(viewport.scrollLeft)
    }

    measure()
    viewport.addEventListener('scroll', handleViewportScroll, { passive: true })
    window.addEventListener('resize', scheduleMeasure)
    // `scroll` não borbulha; capture alcança o `<main>` rolável do app sem
    // acoplar a lib à estrutura do host.
    window.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true })

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleMeasure)
    observer?.observe(viewport)
    observer?.observe(content)

    return () => {
      viewport.removeEventListener('scroll', handleViewportScroll)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, { capture: true })
      observer?.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [contentRef, measure, onScrollLeftChange, scrollViewportRef])

  const handleVirtualScroll = (event: UIEvent<HTMLDivElement>) => {
    const scrollLeft = event.currentTarget.scrollLeft
    const viewport = scrollViewportRef.current
    if (viewport && viewport.scrollLeft !== scrollLeft) viewport.scrollLeft = scrollLeft
    onScrollLeftChange?.(scrollLeft)
  }

  if (!metrics.visible) return null

  return (
    <div
      ref={virtualScrollerRef}
      data-virtual-scroller
      aria-hidden
      onScroll={handleVirtualScroll}
      style={{
        left: metrics.left,
        width: metrics.width,
        bottom: metrics.bottom,
      }}
      className={cn(
        'fixed z-30 h-3 overflow-x-auto overflow-y-hidden rounded-full border border-divider bg-contrast/95 shadow-sm backdrop-blur-sm',
        CUBS_SCROLLBAR_CLASS_NAME,
        className,
      )}
    >
      <div style={{ width: metrics.contentWidth }} className="h-px" />
    </div>
  )
}
