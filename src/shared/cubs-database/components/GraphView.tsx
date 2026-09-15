import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { Icon } from '@iconify/react'
import { Button } from 'cubs-components'

import type { RowData } from '../types'
import { stepGraphPhysics, type ForceGraphNode } from './graphPhysics'

interface GraphPoint extends ForceGraphNode {
  id: string
  title: string
  x: number
  y: number
  parentId?: string
  depth: number
}

function titleOf(row: RowData): string {
  const title = row.cells.page_title?.value
  return typeof title === 'string' && title.trim() ? title : 'Sem Título'
}

function radiusOf(title: string, depth: number): number {
  return Math.min(depth === 0 ? 105 : 88, 34 + title.length * 3.4)
}

function layoutGraph(rootId: string, rootTitle: string, childrenByParent: Record<string, RowData[]>): GraphPoint[] {
  const points: GraphPoint[] = [{
    id: rootId,
    title: rootTitle,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: radiusOf(rootTitle, 0),
    depth: 0,
  }]
  const seen = new Set([rootId])
  for (let index = 0; index < points.length; index += 1) {
    const parent = points[index]
    const children = childrenByParent[parent.id] ?? []
    children.forEach((row, childIndex) => {
      if (seen.has(row.id)) return
      seen.add(row.id)
      const baseAngle = parent.depth === 0 ? -Math.PI / 2 : Math.atan2(parent.y, parent.x)
      const angle = parent.depth === 0
        ? baseAngle + (2 * Math.PI * childIndex) / Math.max(children.length, 1)
        : baseAngle + (childIndex - (children.length - 1) / 2) * 0.58
      const distance = parent.depth === 0 ? 210 : 170
      points.push({
        id: row.id,
        title: titleOf(row),
        x: parent.x + Math.cos(angle) * distance,
        y: parent.y + Math.sin(angle) * distance,
        vx: 0,
        vy: 0,
        radius: radiusOf(titleOf(row), parent.depth + 1),
        parentId: parent.id,
        depth: parent.depth + 1,
      })
    })
  }
  return points
}

export function GraphNode({
  point,
  focused,
  dragging,
  loading,
  onFocus,
}: {
  point: GraphPoint
  focused: boolean
  dragging: boolean
  loading: boolean
  onFocus: () => void
}) {
  return (
    <Button
      type="button"
      variant="text"
      color="from-theme"
      data-graph-node={point.id}
      aria-pressed={focused}
      onClick={onFocus}
      style={{ left: `calc(50% + ${point.x}px)`, top: `calc(50% + ${point.y}px)` }}
      className={`absolute z-10 flex max-w-40 -translate-x-1/2 -translate-y-1/2 select-none items-center justify-start gap-2 rounded-full border px-3 py-2 text-left text-sm font-normal shadow-sm transition-colors active:translate-y-[-50%] ${dragging ? 'cursor-grabbing' : 'cursor-grab'} ${focused ? 'border-p-purple bg-p-purple text-white hover:bg-p-purple' : 'border-divider bg-background hover:border-p-purple hover:bg-background'}`}
    >
      <Icon
        icon={point.depth === 0 ? 'lucide:circle-dot-dashed' : 'lucide:file-text'}
        fontSize={15}
        className="shrink-0"
      />
      <span className="truncate">{point.title}</span>
      {loading && <Icon icon="lucide:loader-circle" fontSize={14} className="shrink-0 animate-spin" />}
    </Button>
  )
}

function GraphEdges({ points }: { points: GraphPoint[] }) {
  const byId = new Map(points.map((point) => [point.id, point]))
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible" width="1" height="1">
      {points.map((point) => {
        const parent = point.parentId ? byId.get(point.parentId) : undefined
        return parent ? (
          <line key={point.id} x1={parent.x} y1={parent.y} x2={point.x} y2={point.y} className="stroke-divider-contrast" strokeWidth="1.5" />
        ) : null
      })}
    </svg>
  )
}

export function GraphCanvas({
  points,
  focusedId,
  loadingIds,
  onFocus,
}: {
  points: GraphPoint[]
  focusedId: string
  loadingIds: Set<string>
  onFocus: (point: GraphPoint) => void
}) {
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [renderPoints, setRenderPoints] = useState(points)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const pointsRef = useRef(points)
  const panDragRef = useRef<{ x: number; y: number } | null>(null)
  const nodeDragRef = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null)
  const suppressFocusRef = useRef<string | null>(null)
  const frameRef = useRef<number | null>(null)
  const tickRef = useRef<() => void>(() => undefined)

  const wakeSimulation = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      // O frame acabou de ser consumido. Liberar o slot antes do tick permite
      // que qualquer drag ocorrido nesse intervalo reative o loop.
      frameRef.current = null
      tickRef.current()
    })
  }, [])

  tickRef.current = () => {
    const next = stepGraphPhysics(pointsRef.current, nodeDragRef.current?.id)
    pointsRef.current = next
    setRenderPoints(next)
    const moving = next.some((point) => Math.abs(point.vx) + Math.abs(point.vy) > 0.018)
    if (moving || nodeDragRef.current) wakeSimulation()
  }

  useEffect(() => {
    const previous = new Map(pointsRef.current.map((point) => [point.id, point]))
    const sameRoot = pointsRef.current[0]?.id === points[0]?.id
    const next = points.map((point) => {
      const current = sameRoot ? previous.get(point.id) : undefined
      return current ? { ...point, x: current.x, y: current.y, vx: current.vx, vy: current.vy } : point
    })
    pointsRef.current = next
    setRenderPoints(next)
    wakeSimulation()
  }, [points, wakeSimulation])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }, [])

  const focusPoint = (point: GraphPoint) => {
    if (suppressFocusRef.current === point.id) {
      suppressFocusRef.current = null
      return
    }
    setPan({ x: -point.x * zoom, y: -point.y * zoom })
    onFocus(point)
  }
  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const node = event.target instanceof Element
      ? event.target.closest<HTMLElement>('[data-graph-node]')
      : null
    if (node?.dataset.graphNode) {
      nodeDragRef.current = { id: node.dataset.graphNode, x: event.clientX, y: event.clientY, moved: false }
      setDraggingId(node.dataset.graphNode)
      wakeSimulation()
    } else if (event.target === event.currentTarget) {
      panDragRef.current = { x: event.clientX, y: event.clientY }
    } else {
      return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (nodeDragRef.current) {
      const drag = nodeDragRef.current
      const deltaX = (event.clientX - drag.x) / zoom
      const deltaY = (event.clientY - drag.y) / zoom
      if (deltaX === 0 && deltaY === 0) return
      nodeDragRef.current = { ...drag, x: event.clientX, y: event.clientY, moved: true }
      const next = pointsRef.current.map((point) => point.id === drag.id
        ? { ...point, x: point.x + deltaX, y: point.y + deltaY, vx: 0, vy: 0 }
        : point)
      pointsRef.current = next
      setRenderPoints(next)
      wakeSimulation()
      return
    }
    if (!panDragRef.current) return
    const deltaX = event.clientX - panDragRef.current.x
    const deltaY = event.clientY - panDragRef.current.y
    panDragRef.current = { x: event.clientX, y: event.clientY }
    setPan((previous) => ({ x: previous.x + deltaX, y: previous.y + deltaY }))
  }
  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const nodeDrag = nodeDragRef.current
    if (nodeDrag?.moved) {
      const draggedId = nodeDrag.id
      suppressFocusRef.current = draggedId
      // O click sintético do mesmo gesto vem logo após pointerup. Limpar no
      // próximo task impede que um drag sem click bloqueie o próximo foco real.
      window.setTimeout(() => {
        if (suppressFocusRef.current === draggedId) suppressFocusRef.current = null
      }, 0)
    } else if (nodeDrag) {
      const focusedPoint = pointsRef.current.find((point) => point.id === nodeDrag.id)
      if (focusedPoint) {
        focusPoint(focusedPoint)
        // O pointer capture do canvas pode redirecionar o click sintético ao
        // próprio canvas. Se o browser o entregar ao botão, evitar foco duplo.
        suppressFocusRef.current = nodeDrag.id
        window.setTimeout(() => {
          if (suppressFocusRef.current === nodeDrag.id) suppressFocusRef.current = null
        }, 0)
      }
    }
    nodeDragRef.current = null
    panDragRef.current = null
    setDraggingId(null)
    wakeSimulation()
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setZoom((previous) => Math.min(2, Math.max(0.5, previous - event.deltaY * 0.001)))
  }

  return (
    <div
      role="application"
      aria-label="Grafo de páginas"
      data-graph-canvas
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ backgroundPosition: `${pan.x}px ${pan.y}px` }}
      className="relative h-[min(70vh,700px)] min-h-96 w-full touch-none overflow-hidden bg-background [background-image:radial-gradient(circle,var(--color-divider-contrast)_1px,transparent_1px)] [background-size:24px_24px]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <GraphEdges points={renderPoints} />
        {renderPoints.map((point) => (
          <div key={point.id} className="pointer-events-auto contents">
            <GraphNode
              point={point}
              focused={point.id === focusedId}
              dragging={point.id === draggingId}
              loading={loadingIds.has(point.id)}
              onFocus={() => focusPoint(point)}
            />
          </div>
        ))}
      </div>
      <div className="absolute bottom-4 right-4 z-20 flex gap-1 rounded-lg border border-divider bg-background p-1 shadow-sm">
        <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => Math.max(0.5, value - 0.2))} className="rounded p-2 hover:bg-active"><Icon icon="lucide:minus" /></button>
        <button type="button" aria-label="Centralizar grafo" onClick={() => {
          const reset = points.map((point) => ({ ...point, vx: 0, vy: 0 }))
          pointsRef.current = reset
          setRenderPoints(reset)
          setPan({ x: 0, y: 0 })
          setZoom(1)
          wakeSimulation()
        }} className="rounded p-2 hover:bg-active"><Icon icon="lucide:scan" /></button>
        <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => Math.min(2, value + 0.2))} className="rounded p-2 hover:bg-active"><Icon icon="lucide:plus" /></button>
      </div>
    </div>
  )
}

export function GraphView({
  rootId,
  rootTitle,
  rows,
  loadSubItems,
  onLoadChildren,
}: {
  rootId: string
  rootTitle: string
  rows: RowData[]
  loadSubItems: boolean
  onLoadChildren?: (pageId: string) => Promise<RowData[]>
}) {
  const [childrenByParent, setChildrenByParent] = useState<Record<string, RowData[]>>({})
  const [focusedId, setFocusedId] = useState(rootId)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const inFlightRef = useRef(new Set<string>())
  const loadedRef = useRef(new Set<string>())
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setChildrenByParent({})
    setFocusedId(rootId)
    setLoadingIds(new Set())
    inFlightRef.current.clear()
    loadedRef.current.clear()
    setLoadError(false)
  }, [rootId])

  const loadChildren = useCallback(async (id: string) => {
    if (!onLoadChildren || loadedRef.current.has(id) || inFlightRef.current.has(id)) return
    inFlightRef.current.add(id)
    setLoadingIds((previous) => new Set(previous).add(id))
    try {
      const children = await onLoadChildren(id)
      loadedRef.current.add(id)
      setChildrenByParent((previous) => ({ ...previous, [id]: children }))
      setLoadError(false)
    } catch {
      setLoadError(true)
    } finally {
      inFlightRef.current.delete(id)
      setLoadingIds((previous) => { const next = new Set(previous); next.delete(id); return next })
    }
  }, [onLoadChildren])

  useEffect(() => {
    if (!loadSubItems) return
    let cancelled = false
    let nextIndex = 0
    const worker = async () => {
      while (!cancelled && nextIndex < rows.length) {
        const row = rows[nextIndex]
        nextIndex += 1
        await loadChildren(row.id)
      }
    }
    // Um grafo grande não dispara uma request por nó de uma vez.
    for (let index = 0; index < Math.min(4, rows.length); index += 1) void worker()
    return () => { cancelled = true }
  }, [loadChildren, loadSubItems, rows])

  const points = useMemo(() => layoutGraph(rootId, rootTitle, { ...childrenByParent, [rootId]: rows }), [childrenByParent, rootId, rootTitle, rows])
  return (
    <div className="px-4">
      <GraphCanvas
        points={points}
        focusedId={focusedId}
        loadingIds={loadingIds}
        onFocus={(point) => { setFocusedId(point.id); if (point.id !== rootId) void loadChildren(point.id) }}
      />
      {loadError && <p role="alert" className="mt-2 text-sm text-p-red">Não foi possível carregar os subitens.</p>}
    </div>
  )
}
