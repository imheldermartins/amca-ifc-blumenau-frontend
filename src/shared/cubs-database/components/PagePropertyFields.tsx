import type {CellChange, HeaderCol, RowData} from '../types'
import {useEffect, useRef} from 'react'
import {DndContext, closestCenter, type DragEndEvent} from '@dnd-kit/core'
import {SortableContext, arrayMove, useSortable} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'
import {Icon} from '@iconify/react'
import {cn} from 'cubs-components'
import {TableCell} from './TableCell'
import {useSortableSensors} from './dndSensors'

// Inputs are whole-row dropzones. Keep their geometry stable during a drag;
// highlight the target and apply the new order on drop instead of moving inputs.
const stablePropertyDropzones = () => null

function PropertyRow({column, row, locked, onChange, sortable}: {column: HeaderCol; row: RowData; locked?: boolean; onChange?: (change: CellChange) => void; sortable: boolean}) {
  const {attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver} = useSortable({id: column.id, disabled: !sortable})
  return <div ref={setNodeRef} data-page-property-id={column.id} data-property-dropzone={sortable || undefined} data-dragging={isDragging || undefined}
    style={{transform: CSS.Transform.toString(transform), transition}}
    className={cn('relative grid min-w-0 grid-cols-[minmax(100px,0.35fr)_minmax(0,1fr)] items-start gap-3 rounded-lg p-1.5',
      sortable && 'grid-cols-[20px_minmax(100px,0.35fr)_minmax(0,1fr)]',
      isDragging && 'z-10 bg-background opacity-70 shadow-sm',
      isOver && !isDragging && 'bg-p-purple/5 ring-1 ring-inset ring-p-purple/40')}>
    {sortable && <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Arrastar propriedade ${column.title}`}
      className="col-start-1 mt-1.5 flex size-5 cursor-grab touch-none items-center justify-center rounded text-dark-100 opacity-60 hover:bg-active hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple active:cursor-grabbing dark:text-light-900">
      <Icon icon="lucide:grip-vertical" className="size-3.5" />
    </button>}
    <dt className="break-words py-2 text-sm text-dark-100 dark:text-light-900">{column.title}</dt>
    <dd className="min-w-0 rounded-md border border-divider [&>[role=cell]]:w-full! [&>[role=cell]]:min-h-9 [&>[role=cell]]:border-0">
      <TableCell column={column} row={row} width={280} locked={locked} onCellChange={onChange} />
    </dd>
  </div>
}

/** The row's existing editors, arranged as a labelled page instead of a table. */
export function PagePropertyFields({columns, row, lockedKeys, onChange, onOrderChange, onSortingChange}: {
  columns: HeaderCol[]
  row: RowData
  lockedKeys?: ReadonlySet<string>
  onChange?: (change: CellChange) => void
  onOrderChange?: (columnIds: string[]) => void
  onSortingChange?: (active: boolean) => void
}) {
  const sensors = useSortableSensors()
  const list = useRef<HTMLDListElement>(null)
  const pointerDrag = useRef(false)
  const pointerDrop = useRef<{x: number; y: number} | null>(null)
  useEffect(() => {
    const captureDrop = (event: PointerEvent) => {
      if (pointerDrag.current) pointerDrop.current = {x: event.clientX, y: event.clientY}
    }
    document.addEventListener('pointerup', captureDrop, true)
    return () => document.removeEventListener('pointerup', captureDrop, true)
  }, [])
  const properties = columns.filter(column => column.key !== 'title')
  const end = ({active, over}: DragEndEvent) => {
    let target = over?.id
    const point = pointerDrop.current
    // A fast pointerup can arrive before dnd-kit's last hover render. Resolve
    // the actual release against these registered row dropzones, not stale over.
    if (pointerDrag.current && point) {
      target = [...(list.current?.querySelectorAll<HTMLElement>('[data-property-dropzone=true]') ?? [])].find(element => {
        if (element.dataset.pagePropertyId === active.id) return false
        const rect = element.getBoundingClientRect()
        return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
      })?.dataset.pagePropertyId
    }
    pointerDrag.current = false; pointerDrop.current = null
    if (!onOrderChange || target === undefined || active.id === target) return
    const before = properties.findIndex(column => column.id === active.id)
    const after = properties.findIndex(column => column.id === target)
    if (before < 0 || after < 0) return
    onOrderChange([...columns.filter(column => column.key === 'title').map(column => column.id), ...arrayMove(properties, before, after).map(column => column.id)])
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={event => {pointerDrag.current = event.activatorEvent.type !== 'keydown'; pointerDrop.current = null; onSortingChange?.(true)}}
    onDragCancel={() => {pointerDrag.current = false; pointerDrop.current = null; onSortingChange?.(false)}} onDragEnd={event => {end(event); onSortingChange?.(false)}}>
    <SortableContext items={properties.map(column => column.id)} strategy={stablePropertyDropzones}>
      <dl ref={list} className="space-y-1" data-page-property-fields>
        {properties.map(column => <PropertyRow key={column.id} column={column} row={row} locked={lockedKeys?.has(column.id)} onChange={onChange} sortable={Boolean(onOrderChange)} />)}
      </dl>
    </SortableContext>
  </DndContext>
}
