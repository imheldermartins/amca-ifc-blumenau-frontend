import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { ContextMenu, cn, type ContextMenuItem } from 'cubs-components'

import type { DataViewKind, DataViewSettings, DataViewType } from '../types'
import { DATA_VIEW_KINDS, VIEW_KIND_ICON } from '../viewKinds'
import { useSortableSensors } from './dndSensors'
import { reorderViewIds } from './viewOrder'

export interface ViewTabsBarProps {
  settings: DataViewSettings
  activeViewId: string
  onViewChange: (viewId: string) => void
  onAddView?: (kind: DataViewKind) => void | Promise<void>
  addViewLabel?: string
  viewTypeLabels?: Record<DataViewKind, string>
  /** Recebe a ordem completa após o drop. A presença habilita o sortable. */
  onViewOrderChange?: (viewIds: string[]) => void
  /** Itens do ContextMenu da tab (aberto SOMENTE com botão direito). */
  viewMenuItems?: (viewId: string, actions: { startRename: () => void }) => ContextMenuItem[]
  onRenameView?: (viewId: string, name: string) => void | Promise<void>
}

interface SortableViewTabProps {
  viewId: string
  view: DataViewType
  active: boolean
  sortable: boolean
  renaming: { viewId: string; name: string } | null
  onRenameChange: (value: string) => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onActivate: () => void
  onContextMenu: (event: MouseEvent<HTMLButtonElement>) => void
}

function SortableViewTab({
  viewId,
  view,
  active,
  sortable,
  renaming,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onActivate,
  onContextMenu,
}: SortableViewTabProps) {
  const editing = renaming?.viewId === viewId
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: viewId,
    disabled: !sortable || editing,
    transition: { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 20 : undefined,
  }
  const tabClass = cn(
    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-sm',
    'transition-[transform,color,background-color,border-color,box-shadow,opacity] duration-200 ease-out',
    sortable && !editing && 'cursor-grab touch-none active:cursor-grabbing',
    active
      ? 'border-divider-contrast bg-active text-foreground shadow-sm'
      : 'border-divider bg-transparent opacity-60 hover:border-divider-contrast hover:bg-contrast hover:opacity-100',
    isDragging && 'opacity-20',
  )

  return (
    <div ref={setNodeRef} style={style} data-sortable-view={viewId}>
      {editing ? (
        <div className={tabClass}>
          <Icon icon={VIEW_KIND_ICON[view.view]} fontSize={15} className="shrink-0" />
          <input
            aria-label={view.name}
            ref={(node) => { if (node && document.activeElement !== node) { node.focus(); node.select() } }}
            value={renaming.name}
            maxLength={120}
            onChange={(event) => onRenameChange(event.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Enter') onRenameCommit()
              if (event.key === 'Escape') onRenameCancel()
            }}
            className="min-w-20 max-w-48 bg-transparent outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          data-state={active ? 'active' : 'inactive'}
          {...attributes}
          {...listeners}
          onClick={onActivate}
          onContextMenu={onContextMenu}
          className={tabClass}
        >
          <Icon
            icon={VIEW_KIND_ICON[view.view]}
            fontSize={15}
            className={cn('shrink-0', active && 'text-p-purple')}
          />
          {view.name}
        </button>
      )}
    </div>
  )
}

function ViewTabDragOverlay({ view, active }: { view: DataViewType; active: boolean }) {
  return (
    <div
      data-view-drag-overlay
      aria-hidden="true"
      className={cn(
        'pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-sm shadow-lg ring-1 ring-p-purple-500/15',
        active
          ? 'border-divider-contrast bg-active text-foreground'
          : 'border-divider-contrast bg-background text-foreground',
      )}
    >
      <Icon
        icon={VIEW_KIND_ICON[view.view]}
        fontSize={15}
        className={cn('shrink-0', active && 'text-p-purple')}
      />
      {view.name}
    </div>
  )
}

/** Tabs horizontais com ordem otimista, sortable animado e persistência pelo host. */
export function ViewTabsBar({
  settings,
  activeViewId,
  onViewChange,
  onAddView,
  addViewLabel = 'Adicionar view',
  viewTypeLabels,
  onViewOrderChange,
  viewMenuItems,
  onRenameView,
}: ViewTabsBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const sensors = useSortableSensors()
  const sourceIds = useMemo(
    () => Object.entries(settings)
      .sort((left, right) =>
        (left[1].order ?? Number.MAX_SAFE_INTEGER) - (right[1].order ?? Number.MAX_SAFE_INTEGER),
      )
      .map(([viewId]) => viewId),
    [settings],
  )
  const [orderedIds, setOrderedIds] = useState(sourceIds)
  const dragStartOrderRef = useRef(sourceIds)
  const [draggingViewId, setDraggingViewId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ viewId?: string; left: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<{ viewId: string; name: string } | null>(null)

  useEffect(() => {
    setOrderedIds(sourceIds)
    dragStartOrderRef.current = sourceIds
  }, [sourceIds])

  const commitRename = () => {
    if (!renaming) return
    const name = renaming.name.trim()
    setRenaming(null)
    if (name && name !== settings[renaming.viewId]?.name) {
      void onRenameView?.(renaming.viewId, name)
    }
  }

  const handleTabContextMenu = (viewId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!viewMenuItems) return
    const barRect = barRef.current?.getBoundingClientRect()
    const tabRect = event.currentTarget.getBoundingClientRect()
    setMenu({ viewId, left: barRect ? tabRect.left - barRect.left : 0 })
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingViewId(null)
    if (!over || active.id === over.id || !onViewOrderChange) return
    const dragStartOrder = dragStartOrderRef.current
    const next = reorderViewIds(dragStartOrder, String(active.id), String(over.id))
    if (next === dragStartOrder) return
    dragStartOrderRef.current = next
    setOrderedIds(next)
    setMenu(null)
    onViewOrderChange(next)
  }

  const handleDragStart = ({ active }: DragStartEvent) => {
    dragStartOrderRef.current = orderedIds
    setDraggingViewId(String(active.id))
  }

  const handleAddView = async (kind: DataViewKind) => {
    if (!onAddView || adding) return
    setAdding(true)
    try {
      await onAddView(kind)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div ref={barRef} className="relative">
      <div className="overflow-x-auto overflow-y-hidden pb-1" onScroll={() => setMenu(null)}>
        <div className="flex w-max min-w-full items-center gap-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragCancel={() => setDraggingViewId(null)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={orderedIds} strategy={horizontalListSortingStrategy}>
              {orderedIds.map((viewId) => {
                const view = settings[viewId]
                if (!view) return null
                const active = viewId === activeViewId
                return (
                  <SortableViewTab
                    key={viewId}
                    viewId={viewId}
                    view={view}
                    active={active}
                    sortable={Boolean(onViewOrderChange) && orderedIds.length > 1}
                    renaming={renaming}
                    onRenameChange={(name) => setRenaming({ viewId, name })}
                    onRenameCommit={commitRename}
                    onRenameCancel={() => setRenaming(null)}
                    onActivate={() => { setMenu(null); if (!active) onViewChange(viewId) }}
                    onContextMenu={(event) => handleTabContextMenu(viewId, event)}
                  />
                )
              })}
            </SortableContext>
            {typeof document !== 'undefined'
              ? createPortal(
                  <DragOverlay adjustScale={false} dropAnimation={null}>
                    {draggingViewId && settings[draggingViewId] ? (
                      <ViewTabDragOverlay
                        view={settings[draggingViewId]}
                        active={draggingViewId === activeViewId}
                      />
                    ) : null}
                  </DragOverlay>,
                  document.body,
                )
              : null}
          </DndContext>
          {onAddView ? (
            <button
              type="button"
              aria-label={addViewLabel}
              aria-haspopup="menu"
              aria-expanded={menu?.viewId === undefined && menu !== null}
              disabled={adding}
              onClick={(event) => {
                const barRect = barRef.current?.getBoundingClientRect()
                const buttonRect = event.currentTarget.getBoundingClientRect()
                const left = barRect ? buttonRect.left - barRect.left : 0
                setMenu((current) => current && current.viewId === undefined ? null : { left })
              }}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground opacity-60 transition-colors hover:bg-contrast hover:opacity-100 focus-visible:outline-2 focus-visible:outline-p-purple disabled:opacity-40"
            >
              <Icon aria-hidden="true" icon="lucide:circle-plus" fontSize={19} />
            </button>
          ) : null}
        </div>
      </div>

      {menu ? (
        <ContextMenu
          open
          onClose={() => setMenu(null)}
          items={menu.viewId
            ? viewMenuItems?.(menu.viewId, {
                startRename: () => {
                  const view = settings[menu.viewId!]
                  if (view && onRenameView) setRenaming({ viewId: menu.viewId!, name: view.name })
                },
              }) ?? []
            : DATA_VIEW_KINDS.map((kind) => ({
                id: kind,
                label: viewTypeLabels?.[kind] ?? kind,
                icon: VIEW_KIND_ICON[kind],
                onSelect: () => { void handleAddView(kind) },
              }))}
          className="top-full"
          style={{ left: menu.left }}
        />
      ) : null}
    </div>
  )
}
