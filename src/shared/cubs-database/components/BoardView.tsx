import { memo, useCallback, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@iconify/react'
import { DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type KeyboardCoordinateGetter } from '@dnd-kit/core'
import { SortableContext, useSortable } from '@dnd-kit/sortable'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import { ColorPicker, DragPlaceholder, OPTION_COLOR_SWATCH, TextField, cn } from 'cubs-components'
import type { BoardCreateInput, BoardMoveInput, BoardViewConfig, CellChange, CellEditConflict, ColumnConfigPatch, FlowDefinition,
  ColumnOption, FlowExecutionResult, FlowMacroOption, FlowMacroSectionsBuilder, HeaderCol, OptionColor, RowData } from '../types'
import { BOARD_UNASSIGNED, boardColumn, boardKey, boardRowOrder, relocateBoardCard } from '../boardView'
import { databaseCardProperties } from '../calendarItems'
import { mappedProps } from '../calendarPropertyRenderers'
import { cellErrorKey, reorderByIds } from '../utils'
import { CELL_EDITORS } from './cells'
import { TextCellEditor } from './cells/TextCellEditor'
import { useExternalDraft } from './cells/useExternalDraft'
import { FlowActionButton } from './FlowActionButton'
import { FlowEditorDialog } from './FlowEditorDialog'
import type { DatabasePagination } from '../pagination'
import { pageViewScopeKey, type PageViewQueryScope } from '../pageViewQueryContract'
import { VirtualInfiniteList } from './VirtualInfiniteList'

const BACKGROUNDS: Record<OptionColor, string> = {
  red: 'bg-p-red-500/10', pink: 'bg-p-pink-500/10', orange: 'bg-p-orange-500/10', yellow: 'bg-p-yellow-500/10',
  green: 'bg-p-green-500/10', blue: 'bg-p-blue-500/10', purple: 'bg-p-purple-500/10', grey: 'bg-p-grey-500/10',
}
const ADD_BUTTON_COLORS: Record<OptionColor, string> = {
  red: 'bg-p-red-500/20 border-p-red-500/40 text-p-red-600 hover:bg-p-red-500/30 dark:text-p-red-400',
  pink: 'bg-p-pink-500/20 border-p-pink-500/40 text-p-pink-600 hover:bg-p-pink-500/30 dark:text-p-pink-400',
  orange: 'bg-p-orange-500/20 border-p-orange-500/40 text-p-orange-600 hover:bg-p-orange-500/30 dark:text-p-orange-400',
  yellow: 'bg-p-yellow-500/20 border-p-yellow-500/40 text-p-yellow-600 hover:bg-p-yellow-500/30 dark:text-p-yellow-400',
  green: 'bg-p-green-500/20 border-p-green-500/40 text-p-green-600 hover:bg-p-green-500/30 dark:text-p-green-400',
  blue: 'bg-p-blue-500/20 border-p-blue-500/40 text-p-blue-600 hover:bg-p-blue-500/30 dark:text-p-blue-400',
  purple: 'bg-p-purple-500/20 border-p-purple-500/40 text-p-purple-600 hover:bg-p-purple-500/30 dark:text-p-purple-400',
  grey: 'bg-p-grey-500/20 border-p-grey-500/40 text-p-grey-600 hover:bg-p-grey-500/30 dark:text-p-grey-400',
}
const handleClass = 'cursor-grab touch-none rounded p-1 opacity-0 transition-opacity group-hover:opacity-70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple disabled:cursor-default'
const noSortTransforms = () => null
const cardId = (id: string) => `card:${id}`
const columnId = (id: string) => `column:${id}`
const boardId = (id: string) => `board:${id}`
type Groups = Record<string, string[]>
const EMPTY_IDS: string[] = []
type HandleProps = ReturnType<typeof useSortable>['attributes'] & Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onKeyDown'>

export interface BoardViewProps {
  pagination?: DatabasePagination
  columns: HeaderCol[]
  rows: RowData[]
  allRows?: RowData[]
  config?: BoardViewConfig
  onConfigChange?: (patch: BoardViewConfig) => void
  onMove?: (input: BoardMoveInput) => Promise<void>
  onCreateRow?: (input: BoardCreateInput) => Promise<RowData | undefined>
  createRequest?: number
  onOpenRow?: (row: RowData) => void
  onCellChange?: (change: CellChange) => void
  onCellEditConflict?: (conflict: CellEditConflict) => void
  onColumnConfigChange?: (columnId: string, patch: ColumnConfigPatch) => void
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  onFlowConfigChange?: (columnId: string, flow: FlowDefinition) => Promise<FlowDefinition | void> | FlowDefinition | void
  onFlowLoadMacros?: (input: { columnId: string; rowId?: string }) => Promise<FlowMacroOption[]>
  buildFlowMacroSections?: FlowMacroSectionsBuilder
  onFlowExecute?: (input: { columnId: string; rowId: string }) => Promise<FlowExecutionResult>
  lockedColumnKeys?: ReadonlySet<string>
  cellErrors?: ReadonlySet<string>
}

interface CardProps extends Pick<BoardViewProps, 'onOpenRow' | 'onCellChange' | 'onCellEditConflict' | 'lockedColumnKeys' | 'cellErrors'> {
  row: RowData
  columns: HeaderCol[]
  color: OptionColor
  showLabels: boolean
  editing?: boolean
  autoFocus?: boolean
  overlay?: boolean
  handle?: HandleProps
  onEdit?: (rowId: string) => void
  onFinish?: () => void
  onFlowOpen?: (row: RowData, column: HeaderCol) => void
}

/** The exact same visual component is rendered in the list and the overlay. */
export const BoardCard = memo(function BoardCard({ row, columns, color, showLabels, editing, autoFocus, overlay, handle, onEdit, onFinish,
  onOpenRow, onCellChange, onCellEditConflict, lockedColumnKeys, cellErrors, onFlowOpen }: CardProps) {
  const titleColumn = columns.find((column) => column.key === 'title')
  const previousTitle = titleColumn ? row.cells[titleColumn.id]?.value : undefined
  const title = String(previousTitle || 'Sem título')
  const locked = (column: HeaderCol) => Boolean(lockedColumnKeys?.has(column.key === 'title' ? 'title' : column.id))
  const properties = databaseCardProperties(row, columns.filter((column) => column !== titleColumn), Boolean(editing))
  const commit = (column: HeaderCol, value: unknown) => {
    if (!overlay && !locked(column)) onCellChange?.({ rowId: row.id, columnId: column.id, value, previousValue: row.cells[column.id]?.value })
  }
  return <article data-board-card={row.id} inert={overlay || undefined} aria-hidden={overlay || undefined} className={cn('group relative w-full min-w-0 rounded-xl border border-foreground/10 p-3 text-sm shadow-sm', BACKGROUNDS[color], overlay && 'pointer-events-none shadow-lg')}
    onDoubleClick={(event) => {
      if (!overlay && !(event.target as HTMLElement).closest('button,input,textarea,[role="combobox"]')) onEdit?.(row.id)
    }} onKeyDown={(event) => { if (editing && event.key === 'Escape') onFinish?.() }}>
    <div className="flex items-center gap-1.5">
      <button type="button" aria-label={`Arrastar ${title}`} className={cn(handleClass, '-ml-1 flex size-6 shrink-0 items-center justify-center', overlay && 'opacity-70')} disabled={!handle} {...handle}><Icon icon="lucide:grip-vertical" className="size-4" /></button>
      <h3 className="min-w-0 flex-1 break-words font-semibold leading-5">
        {editing && titleColumn && onCellChange && !locked(titleColumn) && !overlay ? <TextCellEditor column={titleColumn} rowId={row.id}
          value={previousTitle} autoFocus={autoFocus} hasError={cellErrors?.has(cellErrorKey(row.id, titleColumn.id))}
          onEditingEnd={autoFocus ? onFinish : undefined}
          className="[font:inherit]" inputClassName="h-6 border-0 p-0 [font:inherit]" onCommit={(value) => commit(titleColumn, value)}
          onExternalConflict={() => onCellEditConflict?.({ rowId: row.id, columnId: titleColumn.id, columnTitle: titleColumn.title, value: previousTitle, displayValue: title })} /> : title}
      </h3>
      {editing && !overlay ? <button type="button" aria-label="Concluir edição" title="Concluir edição" onClick={onFinish} className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-active"><Icon icon="lucide:check" className="size-4" /></button> : null}
      {onOpenRow ? <button type="button" aria-label={`Abrir ${title}`} onClick={() => !overlay && onOpenRow(row)} className="flex size-6 shrink-0 items-center justify-center rounded opacity-50 hover:bg-active hover:opacity-100"><Icon icon="lucide:arrow-up-right" className="size-4" /></button> : null}
    </div>
    {properties.length ? <dl className="mt-3 flex min-w-0 flex-col items-start gap-2">
      {properties.map((property) => {
        const column = property.column
        const Editor = CELL_EDITORS[property.type]
        return <div key={property.id} className={cn('flex w-full min-w-0 items-start', showLabels && 'gap-1.5')}>
          <dt className={cn('shrink-0 text-xs opacity-60', !showLabels && 'sr-only')}>{property.label}:</dt>
          <dd className="min-w-0 flex-1 overflow-hidden">
            {property.type === 'flow' ? <FlowActionButton column={column} disabled={locked(column) || !column.flow || !onFlowOpen}
              onClick={() => !overlay && onFlowOpen?.(row, column)} />
              : editing && Editor && onCellChange && !locked(column) && !overlay
                ? <Editor column={column} rowId={row.id} value={property.rawValue} onCommit={(value) => commit(column, value)}
                  hasError={cellErrors?.has(cellErrorKey(row.id, column.id))}
                  onExternalConflict={() => onCellEditConflict?.({ rowId: row.id, columnId: column.id, columnTitle: column.title, value: property.rawValue, displayValue: property.value })} />
                : mappedProps[property.type](property, { compact: true })}
          </dd>
          {locked(column) ? <Icon icon="lucide:lock-keyhole" aria-label="Coluna bloqueada" className="ml-1 size-3 shrink-0 opacity-40" /> : null}
        </div>
      })}
    </dl> : null}
  </article>
})

interface ColumnProps {
  optionKey: string
  title: string
  color: OptionColor
  count: number
  collapsed: boolean
  overlay?: boolean
  handle?: HandleProps
  onToggle?: () => void
  onAdd?: () => void
  addDisabled?: boolean
  onOptionChange?: (patch: Pick<ColumnOption, 'label'> | Pick<ColumnOption, 'color'>) => void
  children?: ReactNode
  reducedMotion?: boolean | null
}

function BoardOptionEditor({ title, color, onChange, onFinish }: {
  title: string; color: OptionColor; onChange: NonNullable<ColumnProps['onOptionChange']>; onFinish: () => void
}) {
  const name = useExternalDraft(title)
  const commit = () => {
    if (name.settle() && name.draft.trim() !== title) onChange({ label: name.draft.trim() })
  }
  return <div className="m-2 mb-0 flex items-center gap-2 rounded-lg bg-background p-2">
    <ColorPicker label="Cor da opção" value={color} onPick={(next) => onChange({ color: next })} />
    <TextField autoFocus aria-label="Nome da opção" surface="plain" size="sm" className="min-w-0 flex-1"
      value={name.draft} onFocus={name.focus} onChange={(event) => name.change(event.target.value)} onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.currentTarget.blur(); onFinish() }
        if (event.key === 'Escape') { event.stopPropagation(); name.revert(); event.currentTarget.blur(); onFinish() }
      }} />
    <button type="button" aria-label="Concluir edição da opção" onClick={onFinish} className="rounded p-1 hover:bg-active"><Icon icon="lucide:check" className="size-4" /></button>
  </div>
}

const BoardAddButton = memo(function BoardAddButton({ color, onAdd, disabled, overlay }: {
  color: OptionColor; onAdd: () => void; disabled?: boolean; overlay?: boolean
}) {
  return <button type="button" disabled={disabled} onClick={() => !overlay && onAdd()}
    className={cn('m-2 mt-0 flex items-center justify-center gap-1 rounded-lg border border-dashed py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait', ADD_BUTTON_COLORS[color])}>
    <Icon icon="lucide:plus" className="size-4" />Adicionar card
  </button>
})

export const BoardColumn = memo(function BoardColumn({ optionKey, title, color, count, collapsed, overlay, handle, onToggle, onAdd, addDisabled, onOptionChange, children, reducedMotion }: ColumnProps) {
  const [editing, setEditing] = useState(false)
  const optionChangeRef = useRef(onOptionChange)
  optionChangeRef.current = onOptionChange
  const canEdit = Boolean(onOptionChange && !overlay)
  if (editing && !canEdit) setEditing(false)
  const edit = () => { if (canEdit) { if (collapsed) onToggle?.(); setEditing(true) } }
  return <motion.section initial={false} data-board-column={optionKey} data-collapsed={collapsed || undefined} inert={overlay || undefined} aria-hidden={overlay || undefined}
    animate={{ width: collapsed ? 48 : 320 }} transition={{ duration: reducedMotion ? 0 : .2 }}
    className={cn('flex min-h-64 shrink-0 flex-col overflow-hidden rounded-xl border border-foreground/10', BACKGROUNDS[color], overlay && 'pointer-events-none shadow-lg')}>
    <header onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest('button,input')) edit() }}
      className={cn('group flex shrink-0 items-center gap-2 p-2 text-white', OPTION_COLOR_SWATCH[color], collapsed && 'flex-1 flex-col')}>
      <button type="button" aria-label={`Arrastar Board ${title}`} disabled={!handle || editing} className={cn(handleClass, overlay && 'opacity-70')} {...(editing ? undefined : handle)}><Icon icon="lucide:grip-vertical" className="size-4" /></button>
      <div className={cn(collapsed ? 'flex h-40 w-6 items-center justify-center' : 'min-w-0 flex-1')}>
        <motion.span animate={{ rotate: collapsed ? 90 : 0 }} transition={{ duration: reducedMotion ? 0 : .2 }}
          role={canEdit ? 'button' : undefined} tabIndex={canEdit ? 0 : undefined} aria-label={canEdit ? `Editar opção ${title}` : undefined}
          onKeyDown={(event) => { if (canEdit && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); edit() } }}
          className={cn('block truncate text-sm font-semibold', collapsed && 'w-40 shrink-0')} title={title}>{title}</motion.span>
      </div>
      <span className="rounded bg-black/10 px-1.5 text-xs tabular-nums">{count}</span>
      <button type="button" aria-label={`${collapsed ? 'Expandir' : 'Recolher'} ${title}`} onClick={() => !overlay && onToggle?.()} disabled={!onToggle}
        className="rounded p-1 hover:bg-white/15"><Icon icon={collapsed ? 'lucide:chevrons-right' : 'lucide:chevrons-left'} className="size-4" /></button>
    </header>
    {!collapsed ? <>
      {editing && onOptionChange && !overlay ? <BoardOptionEditor title={title} color={color} onChange={(patch) => optionChangeRef.current?.(patch)} onFinish={() => setEditing(false)} /> : null}
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">{children}</div>
      {onAdd ? <BoardAddButton color={color} onAdd={onAdd} disabled={addDisabled} overlay={overlay} /> : null}
    </> : null}
  </motion.section>
})

const SortableCard = memo(function SortableCard({ optionKey, disabled, placeholder, height, ...card }: CardProps & {
  optionKey: string; disabled: boolean; placeholder: boolean; height: number
}) {
  const id = card.row.id
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const data = useMemo(() => ({ kind: 'card', optionKey, rowId: id, measure: () => nodeRef.current?.getBoundingClientRect() }), [optionKey, id])
  const sortable = useSortable({ id: cardId(id), disabled, data, strategy: noSortTransforms })
  const handle = useMemo(() => disabled ? undefined : { ...sortable.attributes, ...sortable.listeners }, [disabled, sortable.attributes, sortable.listeners])
  const setNodeRef = sortable.setNodeRef
  const setRef = useCallback((node: HTMLDivElement | null) => { nodeRef.current = node; setNodeRef(node) }, [setNodeRef])
  return <div ref={setRef} className="w-full" style={placeholder ? { height, minHeight: height } : undefined}>
    <motion.div layout="position" className={cn('relative w-full', placeholder && 'h-full')}>
      {placeholder ? <DragPlaceholder /> : <BoardCard {...card} handle={handle} />}
    </motion.div>
  </div>
})

const SortableColumn = memo(function SortableColumn({ optionKey, disabled, placeholder, height, width, children }: {
  optionKey: string; disabled: boolean; placeholder: boolean; height: number; width: number; children: (handle: HandleProps | undefined) => ReactNode
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const data = useMemo(() => ({ kind: 'board', optionKey, measure: () => nodeRef.current?.getBoundingClientRect() }), [optionKey])
  const dropData = useMemo(() => ({ kind: 'column', optionKey }), [optionKey])
  const sortable = useSortable({ id: boardId(optionKey), disabled, data, strategy: noSortTransforms })
  const droppable = useDroppable({ id: columnId(optionKey), data: dropData })
  const handle = useMemo(() => disabled ? undefined : { ...sortable.attributes, ...sortable.listeners }, [disabled, sortable.attributes, sortable.listeners])
  const setNodeRef = sortable.setNodeRef, setDropRef = droppable.setNodeRef
  const setRef = useCallback((node: HTMLDivElement | null) => { nodeRef.current = node; setNodeRef(node); setDropRef(node) }, [setNodeRef, setDropRef])
  return <div ref={setRef} className="shrink-0">
    <motion.div layout="position" className="relative" style={placeholder ? { width, height } : undefined}>
      {placeholder ? <DragPlaceholder /> : children(handle)}
    </motion.div>
  </div>
})

type CardPresentation = Omit<CardProps, 'row' | 'color' | 'editing' | 'autoFocus' | 'overlay' | 'handle'>
interface LaneProps {
  option: ColumnOption
  ids: string[]
  total?: number
  pagination?: DatabasePagination
  rowById: ReadonlyMap<string, RowData>
  presentation: CardPresentation
  collapsed: boolean
  overlay?: boolean
  handle?: HandleProps
  reducedMotion?: boolean | null
  canDrag: boolean
  pending: boolean
  activeCardId?: string
  activeHeight: number
  editingRowId?: string
  createdRowId?: string
  onToggle?: (optionId: string) => void
  onAdd?: (optionId: string) => void
  onOptionChange?: (optionId: string, patch: Pick<ColumnOption, 'label'> | Pick<ColumnOption, 'color'>) => void
}

// This layer never consumes the moving dnd context. Sortable wrappers may
// update their sensors while unchanged column and card visuals stay memoized.
const BoardLane = memo(function BoardLane({ option, ids, rowById, presentation, collapsed, overlay, handle, reducedMotion,
  canDrag, pending, activeCardId, activeHeight, editingRowId, createdRowId, onToggle, onAdd, onOptionChange, total, pagination }: LaneProps) {
  const color = option.color && option.color in BACKGROUNDS ? option.color : 'purple'
  const toggle = useCallback(() => onToggle?.(option.id), [onToggle, option.id])
  const add = useCallback(() => onAdd?.(option.id), [onAdd, option.id])
  const change = useCallback((patch: Pick<ColumnOption, 'label'> | Pick<ColumnOption, 'color'>) => onOptionChange?.(option.id, patch), [onOptionChange, option.id])
  const items = useMemo(() => ids.map(cardId), [ids])
  const scope = useMemo<PageViewQueryScope>(() => ({ type: 'board', optionId: option.id }), [option.id])
  const stream = pagination?.streams[pageViewScopeKey(scope)]
  const projectionReady = Boolean(pagination?.projection)
  const hasStream = Boolean(stream)
  const ensureScope = pagination?.ensureScope
  const laneRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!projectionReady || collapsed || overlay || hasStream || !ensureScope || !laneRef.current) return
    if (typeof IntersectionObserver === 'undefined') { ensureScope(scope); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) ensureScope(scope) })
    observer.observe(laneRef.current)
    return () => observer.disconnect()
  }, [projectionReady, ensureScope, scope, collapsed, overlay, hasStream])
  const rowKey = useCallback((row: RowData) => row.id, [])
  const pinnedIds = useMemo(() => [activeCardId, editingRowId, createdRowId].filter((id): id is string => Boolean(id)), [activeCardId, editingRowId, createdRowId])
  const renderCard = useCallback((id: string) => {
    const row = rowById.get(id)
    if (!row) return null
    const props: CardProps = { ...presentation, row, color, editing: editingRowId === id, autoFocus: createdRowId === id }
    return overlay ? <BoardCard key={id} {...props} overlay /> : <SortableCard key={id} {...props} optionKey={option.id}
      disabled={!canDrag || pending || editingRowId === id} placeholder={activeCardId === id} height={activeCardId === id ? activeHeight : 0} />
  }, [rowById, presentation, color, editingRowId, createdRowId, overlay, option.id, canDrag, pending, activeCardId, activeHeight])
  const contents = useMemo(() => {
    if (pagination && !overlay) return <SortableContext items={items} strategy={noSortTransforms}>
      <VirtualInfiniteList items={ids.flatMap((id) => rowById.get(id) ?? [])} itemKey={rowKey} renderItem={(row) => renderCard(row.id)}
        pagination={pagination} scope={scope} stream={stream} pinnedIds={pinnedIds} estimateSize={96} gap={8} disabled={pending} />
    </SortableContext>
    const cards = ids.map(renderCard)
    return overlay ? cards : <SortableContext items={items} strategy={noSortTransforms}>{cards}</SortableContext>
  }, [ids, rowById, overlay, items, pagination, rowKey, renderCard, scope, stream, pinnedIds, pending])
  const lane = <BoardColumn optionKey={option.id} title={option.label} color={color} count={total ?? ids.length} collapsed={collapsed}
    overlay={overlay} handle={handle} reducedMotion={reducedMotion} onToggle={onToggle ? toggle : undefined}
    onAdd={onAdd ? add : undefined} addDisabled={pending} onOptionChange={onOptionChange && !overlay ? change : undefined}>
    {contents}
  </BoardColumn>
  return pagination ? <div ref={laneRef}>{lane}</div> : lane
})

const collisionDetection: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind
  const containers = args.droppableContainers.filter((entry) => kind === 'board'
    ? entry.data.current?.kind === 'board'
    : entry.data.current?.kind !== 'board')
  if (!args.pointerCoordinates) return closestCenter({ ...args, droppableContainers: containers }).slice(0, 1)
  if (kind === 'board') return pointerWithin({ ...args, droppableContainers: containers }).slice(0, 1)

  // The pointer chooses the Board. Within it, the overlay chooses the nearest
  // card, including through headers and gaps. The moving placeholder cannot
  // compete with the destination cards or keep the drag stuck in its old slot.
  const boards = containers.filter((entry) => entry.data.current?.kind === 'column')
  const boardHit = pointerWithin({ ...args, droppableContainers: boards })[0]
  if (!boardHit) return []
  const optionKey = boards.find((entry) => entry.id === boardHit.id)?.data.current?.optionKey
  const cards = containers.filter((entry) => entry.id !== args.active.id && entry.data.current?.kind === 'card' && entry.data.current.optionKey === optionKey)
  const cardHit = closestCenter({ ...args, droppableContainers: cards })[0]
  return [cardHit ?? boardHit]
}

const measuring = { droppable: { strategy: MeasuringStrategy.Always } }
const pointerOptions = { activationConstraint: { distance: 4 } }

export function BoardView({ columns, rows, allRows = rows, config, onConfigChange, onMove, onCreateRow, createRequest = 0,
  onOpenRow, onCellChange, onCellEditConflict, onColumnConfigChange, onColumnOptionsChange, onFlowConfigChange, onFlowLoadMacros, buildFlowMacroSections,
  onFlowExecute, lockedColumnKeys, cellErrors, pagination }: BoardViewProps) {
  const reducedMotion = useReducedMotion()
  const column = boardColumn(columns, config)
  const [createdRow, setCreatedRow] = useState<RowData | null>(null)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftGroups, setDraftGroups] = useState<Groups | null>(null)
  const [draftOrder, setDraftOrder] = useState<string[] | null>(null)
  const [active, setActive] = useState<{ kind: string; id: string; optionKey: string; row?: RowData; height: number; width: number } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [flowTarget, setFlowTarget] = useState<{ rowId: string; columnId: string } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverKey = useRef<string | null>(null)
  const previousCreateRequest = useRef(createRequest)
  const activeRef = useRef(active); activeRef.current = active
  const groupsRef = useRef(draftGroups); groupsRef.current = draftGroups
  const orderRef = useRef(draftOrder); orderRef.current = draftOrder
  const selectLocked = Boolean(column && lockedColumnKeys?.has(column.id))
  const isPaginated = Boolean(pagination)
  const streams = pagination?.streams
  const onInteractionChange = pagination?.onInteractionChange
  const pinRow = pagination?.pinRow
  const options = useMemo(() => pagination?.projection?.groups ? pagination.projection.groups.map((group) => ({
    id: group.value ?? BOARD_UNASSIGNED, label: group.label, color: (group.color ?? 'grey') as OptionColor,
  })) : column ? [...(column.options ?? []), { id: BOARD_UNASSIGNED, label: 'Sem valor', color: 'grey' as const }] : [], [column, pagination?.projection?.groups])
  // Option order is a view preference and may be updated optimistically while
  // the API catalog acknowledgement is still travelling back.
  const optionOrder = useMemo(() => reorderByIds(options, config?.optionOrder ?? []).map((option) => option.id), [options, config?.optionOrder])
  const collapsed = useMemo(() => new Set(config?.collapsedOptionIds ?? []), [config?.collapsedOptionIds])
  const visibleRows = useMemo(() => createdRow && !rows.some((row) => row.id === createdRow.id)
    ? [...rows, allRows.find((row) => row.id === createdRow.id) ?? createdRow] : rows, [rows, allRows, createdRow])
  const rowById = useMemo(() => new Map([...Object.values(pagination?.streams ?? {}).flatMap((stream) => stream.rows), ...allRows, ...visibleRows].map((row) => [row.id, row])), [allRows, visibleRows, pagination?.streams])
  const interactionActive = Boolean(active || editingRowId || pending || flowTarget)
  useEffect(() => {
    if (!interactionActive) return
    onInteractionChange?.(true)
    return () => onInteractionChange?.(false)
  }, [interactionActive, onInteractionChange])
  useEffect(() => {
    const ids = [...new Set([active?.kind === 'card' ? active.id : null, editingRowId, flowTarget?.rowId].filter((id): id is string => Boolean(id)))]
    ids.forEach((id) => pinRow?.(id, true))
    return () => ids.forEach((id) => pinRow?.(id, false))
  }, [active?.id, active?.kind, editingRowId, flowTarget?.rowId, pinRow])
  const groups = useMemo(() => {
    const result: Groups = Object.fromEntries(optionOrder.map((id) => [id, []]))
    if (isPaginated) {
      for (const key of optionOrder) result[key] = (streams?.[pageViewScopeKey({ type: 'board', optionId: key })]?.rows ?? []).map((row) => row.id)
      if (createdRow && !Object.values(result).some((ids) => ids.includes(createdRow.id)) && column) result[boardKey(createdRow, column)]?.push(createdRow.id)
    } else if (column) visibleRows.forEach((row) => result[boardKey(row, column)]?.push(row.id))
    return result
  }, [column, visibleRows, optionOrder, isPaginated, streams, createdRow])
  const shownGroups = draftGroups ?? groups
  const shownOrder = draftOrder ?? optionOrder
  const baseGroupsRef = useRef(groups); baseGroupsRef.current = groups
  const baseOrderRef = useRef(optionOrder); baseOrderRef.current = optionOrder
  const propertyColumns = useMemo(() => {
    const title = columns.find((entry) => entry.key === 'title')
    const properties = config?.propertyIds === undefined ? columns.filter((entry) => entry !== title)
      : config.propertyIds.flatMap((id) => columns.find((entry) => entry.id === id && entry !== title) ?? [])
    return title ? [title, ...properties] : properties
  }, [columns, config?.propertyIds])

  const keyboardCoordinates: KeyboardCoordinateGetter = useCallback((event, { currentCoordinates, context }) => {
    const direction = event.code
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(direction)) return undefined
    event.preventDefault()
    const moving = activeRef.current
    if (!moving) return undefined
    const currentGroups = groupsRef.current ?? baseGroupsRef.current
    const currentOrder = orderRef.current ?? baseOrderRef.current
    const source = moving.kind === 'card' ? currentOrder.find((key) => currentGroups[key]?.includes(moving.id)) ?? moving.optionKey : moving.optionKey
    let target: string | undefined
    if (direction === 'ArrowLeft' || direction === 'ArrowRight') {
      const key = currentOrder[currentOrder.indexOf(source) + (direction === 'ArrowLeft' ? -1 : 1)]
      if (key) target = moving.kind === 'board' ? boardId(key) : currentGroups[key]?.[0] ? cardId(currentGroups[key][0]) : columnId(key)
    } else if (moving.kind === 'card') {
      const ids = currentGroups[source] ?? []
      const id = ids[ids.indexOf(moving.id) + (direction === 'ArrowUp' ? -1 : 1)]
      if (id) target = cardId(id)
    }
    const rect = target ? context.droppableRects.get(target) : undefined
    const activeRect = context.collisionRect
    return rect && activeRect ? {
      x: currentCoordinates.x + rect.left - activeRect.left + (rect.width - activeRect.width) / 2,
      // Cross the midpoint explicitly so ArrowDown inserts after its target;
      // ArrowUp inserts before it, even when both cards have the same height.
      y: currentCoordinates.y + rect.top - activeRect.top + (rect.height - activeRect.height) / 2 + (direction === 'ArrowDown' ? 1 : direction === 'ArrowUp' ? -1 : 0),
    } : undefined
  }, [])
  const keyboardOptions = useMemo(() => ({ coordinateGetter: keyboardCoordinates }), [keyboardCoordinates])
  const sensors = useSensors(useSensor(PointerSensor, pointerOptions), useSensor(KeyboardSensor, keyboardOptions))
  const clearHover = () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); hoverTimer.current = null; hoverKey.current = null }
  const reset = () => { clearHover(); setExpanded(null); setActive(null); setDraftGroups(null); setDraftOrder(null) }
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])
  useEffect(() => { if (active?.kind === 'card' && !rowById.has(active.id)) reset() }, [rowById, active])
  const deletedRowIds = pagination?.deletedRowIds
  const revoked = pagination?.revoked
  useEffect(() => {
    const removed = new Set(deletedRowIds ?? [])
    if (revoked || (createdRow && removed.has(createdRow.id))) setCreatedRow(null)
    if (revoked || (editingRowId && removed.has(editingRowId))) setEditingRowId(null)
    if (revoked || (flowTarget && removed.has(flowTarget.rowId))) setFlowTarget(null)
    if (revoked || (active?.kind === 'card' && removed.has(active.id))) reset()
  }, [deletedRowIds, revoked, createdRow, editingRowId, flowTarget, active])

  const addRow = useCallback(async (key: string) => {
    if (!column || !onCreateRow || pending || (key !== BOARD_UNASSIGNED && selectLocked)) return
    setPending(true); setError(null)
    try {
      const row = await onCreateRow({ selectColumnId: column.id, optionId: key === BOARD_UNASSIGNED ? null : key })
      if (row) { setCreatedRow(row); setEditingRowId(row.id) }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar o card') }
    finally { setPending(false) }
  }, [column, onCreateRow, pending, selectLocked])
  useEffect(() => {
    if (previousCreateRequest.current === createRequest) return
    previousCreateRequest.current = createRequest
    void addRow(BOARD_UNASSIGNED)
  }, [createRequest, addRow])

  const start = ({ active: item }: DragStartEvent) => {
    const data = item.data.current
    if (!data) return
    const rect = data.measure?.() ?? item.rect.current.initial
    setError(null)
    setActive({ kind: data.kind, id: data.rowId ?? data.optionKey, optionKey: data.optionKey,
      row: data.rowId ? rowById.get(data.rowId) : undefined, height: rect?.height ?? 96, width: rect?.width ?? 320 })
    setDraftGroups(groups)
    setDraftOrder(optionOrder)
  }
  const over = ({ active: item, over: target }: DragOverEvent) => {
    if (!target || !activeRef.current) { clearHover(); setExpanded(null); return }
    const targetKey = target.data.current?.optionKey as string | undefined
    if (!targetKey) return
    if (item.data.current?.kind === 'board') {
      setDraftOrder((current) => {
        if (!current) return current
        const from = current.indexOf(item.data.current?.optionKey), to = current.indexOf(targetKey)
        if (from < 0 || to < 0 || from === to) return current
        const next = [...current]; next.splice(to, 0, next.splice(from, 1)[0]!); return next
      })
      return
    }
    if (collapsed.has(targetKey) && hoverKey.current !== targetKey) {
      clearHover(); setExpanded(null); hoverKey.current = targetKey
      hoverTimer.current = setTimeout(() => setExpanded(targetKey), 400)
    } else if (!collapsed.has(targetKey)) { clearHover(); setExpanded(null) }
    const translated = item.rect.current.translated
    const insertAfter = target.data.current?.kind === 'card' && translated
      && translated.top + translated.height / 2 > target.rect.top + target.rect.height / 2
    setDraftGroups((current) => {
      if (!current) return current
      const id = item.data.current?.rowId as string
      const source = Object.keys(current).find((key) => current[key]?.includes(id))
      if (!source || !current[targetKey] || ((selectLocked || !onCellChange) && targetKey !== activeRef.current?.optionKey)) return current
      if (target.data.current?.rowId === id) return current
      return relocateBoardCard(current, id, targetKey, target.data.current?.rowId, Boolean(insertAfter))
    })
  }
  const end = async ({ over: target }: DragEndEvent) => {
    const moving = activeRef.current
    if (!target || !moving) { reset(); return }
    clearHover(); setExpanded(null); setActive(null)
    if (moving.kind === 'board') {
      const next = orderRef.current
      if (next && next.join('|') !== optionOrder.join('|')) onConfigChange?.({ selectColumnId: column?.id, optionOrder: next })
      setDraftGroups(null); setDraftOrder(null); return
    }
    const current = groupsRef.current ?? groups
    const key = Object.keys(current).find((id) => current[id]?.includes(moving.id))
    if (!key || !column || !onMove || ((selectLocked || !onCellChange) && key !== moving.optionKey)) { reset(); return }
    const ids = current[key]!, index = ids.indexOf(moving.id)
    if (key === moving.optionKey && ids.join('|') === groups[key]?.join('|')) { reset(); return }
    const anchors = { beforeId: ids[index + 1], afterId: ids[index - 1] }
    const orderedRows = pagination ? undefined : boardRowOrder(allRows, moving.id, anchors.beforeId, anchors.afterId)
    setPending(true)
    try { await onMove({ rowId: moving.id, selectColumnId: column.id, optionId: key === BOARD_UNASSIGNED ? null : key,
      ...(pagination ? { previousOptionId: moving.optionKey === BOARD_UNASSIGNED ? null : moving.optionKey,
        ...anchors, ...(!anchors.beforeId && !anchors.afterId ? { boundary: 'start' as const } : {}) } : { orderedRows }) }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível mover o card') }
    finally { setPending(false); setDraftGroups(null); setDraftOrder(null) }
  }
  const finishEdit = useCallback(() => { setEditingRowId(null); setCreatedRow(null) }, [])
  const openFlow = useCallback((selected: RowData, flow: HeaderCol) => setFlowTarget({ rowId: selected.id, columnId: flow.id }), [])
  const presentation: CardPresentation = useMemo(() => ({ columns: propertyColumns,
    showLabels: config?.showPropertyLabels !== false, onEdit: onCellChange ? setEditingRowId : undefined, onFinish: finishEdit,
    onOpenRow, onCellChange, onCellEditConflict, lockedColumnKeys, cellErrors, onFlowOpen: onFlowExecute ? openFlow : undefined,
  }), [propertyColumns, config?.showPropertyLabels, onCellChange, finishEdit, onOpenRow, onCellEditConflict, lockedColumnKeys, cellErrors, onFlowExecute, openFlow])
  const toggleOption = useCallback((key: string) => {
    const ids = new Set(collapsed); if (ids.has(key)) ids.delete(key); else ids.add(key)
    onConfigChange?.({ selectColumnId: column?.id, collapsedOptionIds: optionOrder.filter((id) => ids.has(id)) })
  }, [collapsed, onConfigChange, column?.id, optionOrder])
  const changeOption = useCallback((key: string, patch: Pick<ColumnOption, 'label'> | Pick<ColumnOption, 'color'>) => {
    if (column && !selectLocked && key !== BOARD_UNASSIGNED) onColumnOptionsChange?.(column.id, (column.options ?? []).map((entry) => entry.id === key ? { ...entry, ...patch } : entry))
  }, [column, selectLocked, onColumnOptionsChange])
  const renderColumn = (key: string, handle?: HandleProps, overlay = false) => {
    const option = options.find((entry) => entry.id === key)
    if (!option) return null
    const ids = shownGroups[key] ?? EMPTY_IDS
    const activeCardId = active?.kind === 'card' && ids.includes(active.id) ? active.id : undefined
    return <BoardLane option={option} ids={ids} rowById={rowById} presentation={presentation}
      pagination={pagination} total={pagination?.projection?.groups?.find((group) => (group.value ?? BOARD_UNASSIGNED) === key)?.total}
      collapsed={collapsed.has(key) && expanded !== key} overlay={overlay} handle={handle} reducedMotion={reducedMotion}
      canDrag={Boolean(onMove)} pending={pending} activeCardId={activeCardId} activeHeight={activeCardId ? active!.height : 0}
      editingRowId={editingRowId && ids.includes(editingRowId) ? editingRowId : undefined}
      createdRowId={createdRow && ids.includes(createdRow.id) ? createdRow.id : undefined}
      onToggle={onConfigChange ? toggleOption : undefined}
      onOptionChange={onColumnOptionsChange && key !== BOARD_UNASSIGNED && !selectLocked ? changeOption : undefined}
      onAdd={onCreateRow && (key === BOARD_UNASSIGNED || !selectLocked) ? addRow : undefined} />
  }
  const flowColumn = flowTarget ? columns.find((entry) => entry.id === flowTarget.columnId) : undefined
  const flowLocked = Boolean(flowColumn && lockedColumnKeys?.has(flowColumn.id))
  if (!column) return <p className="rounded-xl border border-dashed border-divider p-8 text-center text-sm opacity-60">Adicione uma propriedade select ou escolha uma nas configurações do Board.</p>
  return <MotionConfig reducedMotion="user" transition={{ duration: .2 }}><div data-database-board aria-busy={pending || undefined}>
    {error ? <p role="alert" className="mb-3 text-sm text-p-red">{error}</p> : null}
    <DndContext sensors={sensors} measuring={measuring} collisionDetection={collisionDetection} onDragStart={start} onDragOver={over}
      onDragMove={(event) => {
        // onDragOver fires only when the target id changes. Reproject while
        // crossing the same card's midpoint as well, using current geometry.
        if (event.active.data.current?.kind === 'card' && (!event.collisions || event.collisions[0]?.id === event.over?.id)) over(event)
      }} onDragCancel={reset} onDragEnd={(event) => { void end(event) }}>
      <motion.div layoutScroll className="flex items-stretch gap-3 overflow-x-auto px-1 pb-4" style={{ scrollbarGutter: 'stable' } as CSSProperties}>
        <SortableContext items={shownOrder.map(boardId)} strategy={noSortTransforms}>
          {shownOrder.map((key) => <SortableColumn key={key} optionKey={key} disabled={!onConfigChange || pending} placeholder={active?.kind === 'board' && active.id === key} height={active?.height ?? 256} width={active?.width ?? 320}>
            {(handle) => renderColumn(key, handle)}
          </SortableColumn>)}
        </SortableContext>
      </motion.div>
      {createPortal(<DragOverlay dropAnimation={reducedMotion ? null : { duration: 200, easing: 'ease-out' }}>
        {active ? <div style={{ width: active.width, height: active.height }}>
          {active.kind === 'card' && active.row ? <div className="rounded-xl bg-background"><div className={cn('rounded-xl', BACKGROUNDS[options.find((option) => option.id === active.optionKey)?.color ?? 'purple'])}>
            <BoardCard {...presentation} row={active.row} color={options.find((option) => option.id === active.optionKey)?.color ?? 'purple'}
              editing={editingRowId === active.row.id} autoFocus={createdRow?.id === active.row.id} overlay />
          </div></div> : renderColumn(active.optionKey, undefined, true)}
        </div> : null}
      </DragOverlay>, document.body)}
    </DndContext>
    <FlowEditorDialog open={Boolean(flowTarget)} mode="execute" readOnly={flowLocked} column={flowColumn ?? null} row={flowTarget ? rowById.get(flowTarget.rowId) : undefined}
      columns={columns} onOpenChange={(open) => { if (!open) setFlowTarget(null) }} loadMacros={onFlowLoadMacros} buildMacroSections={buildFlowMacroSections}
      onExecute={flowLocked ? undefined : onFlowExecute} onSave={flowLocked ? undefined : onFlowConfigChange} onButtonChange={flowLocked ? undefined : onColumnConfigChange} />
  </div></MotionConfig>
}
