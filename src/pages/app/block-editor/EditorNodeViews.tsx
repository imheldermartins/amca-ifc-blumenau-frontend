import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from '@tiptap/react'
import { ContextMenu, DragPlaceholder, dragPlaceholderStyle, cn, type ContextMenuItem } from 'cubs-components'
import {
  useRef,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'

import { i18n } from '@/lib/i18n'

import { type EditorDropTarget } from './blockLayout'
import { ColumnLayoutRules, MAX_COLUMNS } from './columnLayoutRules'
import { type EditorDragData } from './EditorDnd'
import { EditorDropPlaceholder } from './EditorDropPlaceholder'
import { useEditorInteractions } from './EditorInteractionContext'
import { useEditorEnvironment } from './editorEnvironmentContext'

function stringAttribute(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function resolvedPosition({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>) {
  const position = getPos()
  return typeof position === 'number' &&
    position >= 0 &&
    position <= editor.state.doc.content.size
    ? editor.state.doc.resolve(position)
    : null
}

function ancestorDepth(
  resolved: ReturnType<typeof resolvedPosition>,
  nodeName: string,
): number | null {
  if (!resolved) return null
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (resolved.node(depth).type.name === nodeName) return depth
  }
  return null
}

interface RowLayout {
  columnIds: string[]
  widths: number[]
}

function readRowLayout(row: ProseMirrorNode | null): RowLayout {
  if (!row) return { columnIds: [], widths: [] }

  const columnIds: string[] = []
  const storedWidths: unknown[] = []
  row.forEach((column) => {
    columnIds.push(stringAttribute(column.attrs.id) ?? '')
    storedWidths.push(column.attrs.span)
  })
  return {
    columnIds,
    widths: ColumnLayoutRules.normalize(storedWidths),
  }
}

function commitRowWidths(
  editor: Editor,
  rowId: string,
  widths: readonly unknown[],
): void {
  let row: ProseMirrorNode | undefined
  let rowPosition = -1

  let offset = 0
  for (let index = 0; index < editor.state.doc.childCount; index += 1) {
    const candidate = editor.state.doc.child(index)
    if (candidate.type.name === 'blockRow' && candidate.attrs.id === rowId) {
      row = candidate
      rowPosition = offset
      break
    }
    offset += candidate.nodeSize
  }
  if (!row || rowPosition < 0) return

  const normalized = ColumnLayoutRules.normalize(widths)
  if (normalized.length !== row.childCount) return

  let columnPosition = rowPosition + 1
  let changed = false
  const transaction = editor.state.tr
  row.forEach((column, _offset, index) => {
    const width = normalized[index]
    if (Math.abs(ColumnLayoutRules.storedWidth(column.attrs.span) - width) > 0.0001) {
      transaction.setNodeMarkup(columnPosition, undefined, {
        ...column.attrs,
        span: width,
      })
      changed = true
    }
    columnPosition += column.nodeSize
  })

  if (changed) editor.view.dispatch(transaction)
}

export function BlockRowView({ node }: NodeViewProps) {
  const rowId = stringAttribute(node.attrs.id) ?? crypto.randomUUID()
  const { active } = useDndContext()
  const activeData = active?.data.current as EditorDragData | undefined
  const disabled = Boolean(
    activeData &&
    activeData.rowId === rowId &&
    node.childCount === 1 &&
    activeData.columnItemCount === 1,
  )
  const beforeId = `row:${rowId}:before`
  const afterId = `row:${rowId}:after`
  const beforeTarget: EditorDropTarget = { type: 'row', rowId, edge: 'before' }
  const afterTarget: EditorDropTarget = { type: 'row', rowId, edge: 'after' }
  const before = useDroppable({ id: beforeId, data: beforeTarget, disabled })
  const after = useDroppable({ id: afterId, data: afterTarget, disabled })

  return (
    <NodeViewWrapper className="cubs-editor-row" data-editor-row="" data-row-id={rowId}>
      <EditorDropPlaceholder id={beforeId} setNodeRef={before.setNodeRef} className="cubs-editor-row-drop-zone is-before" />
      <NodeViewContent className="cubs-editor-row-content" />
      <EditorDropPlaceholder id={afterId} setNodeRef={after.setNodeRef} className="cubs-editor-row-drop-zone is-after" />
    </NodeViewWrapper>
  )
}

interface ColumnResizeSession {
  columnIds: string[]
  currentWidths: number[]
  initialWidths: number[]
  rowWidth: number
  startX: number
}

export function BlockColumnView({ editor, getPos, node }: NodeViewProps) {
  const columnId = stringAttribute(node.attrs.id) ?? crypto.randomUUID()
  const resolved = resolvedPosition({ editor, getPos })
  const rowDepth = ancestorDepth(resolved, 'blockRow')
  const rowNode = rowDepth === null || !resolved ? null : resolved.node(rowDepth)
  const rowId = stringAttribute(rowNode?.attrs.id) ?? ''
  const columnIndex = rowDepth === null || !resolved ? -1 : resolved.index(rowDepth)
  const rowLayout = readRowLayout(rowNode)
  const storedWidth = rowLayout.widths[columnIndex]
    ?? ColumnLayoutRules.storedWidth(node.attrs.span)
  const nextColumn =
    rowNode && columnIndex >= 0 && columnIndex + 1 < rowNode.childCount
      ? rowNode.child(columnIndex + 1)
      : null
  const hasNextColumn = nextColumn?.type.name === 'blockColumn'
  const { active } = useDndContext()
  const {
    clearColumnWidthPreview,
    columnWidthPreview,
    setColumnWidthPreview,
  } = useEditorInteractions()
  const width = columnWidthPreview[columnId] ?? storedWidth
  const activeData = active?.data.current as EditorDragData | undefined
  const removesSourceColumn =
    activeData?.rowId === rowId && activeData.columnItemCount === 1
  const columnDropDisabled = Boolean(
    activeData &&
    ((activeData.columnId === columnId && activeData.columnItemCount === 1) ||
      (rowNode?.childCount === MAX_COLUMNS && !removesSourceColumn)),
  )
  const leftId = `column:${columnId}:left`
  const rightId = `column:${columnId}:right`
  const leftTarget: EditorDropTarget = { type: 'column', columnId, edge: 'left' }
  const rightTarget: EditorDropTarget = { type: 'column', columnId, edge: 'right' }
  const leftDrop = useDroppable({
    id: leftId,
    data: leftTarget,
    disabled: columnDropDisabled,
  })
  const rightDrop = useDroppable({
    id: rightId,
    data: rightTarget,
    disabled: columnDropDisabled,
  })
  const resizeSession = useRef<ColumnResizeSession | null>(null)
  const columnElementRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const host = columnElementRef.current?.parentElement
    if (!host) return
    host.style.setProperty('--editor-column-grow', String(width))
    return () => {
      host.style.removeProperty('--editor-column-grow')
    }
  }, [width])

  const previewWidths = (columnIds: readonly string[], widths: readonly number[]) => {
    setColumnWidthPreview(columnIds.map((id, index) => ({
      columnId: id,
      width: widths[index],
    })))
  }

  const handleResizePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!hasNextColumn || !rowId || columnIndex < 0) return

    const rowElement = event.currentTarget.closest<HTMLElement>('.cubs-editor-row-content')
    const rowWidth = Array.from(
      rowElement?.querySelectorAll<HTMLElement>(':scope [data-editor-column]') ?? [],
    ).reduce((total, column) => total + column.getBoundingClientRect().width, 0)
    if (rowWidth <= 0 || rowLayout.columnIds.some((id) => !id)) return

    event.currentTarget.setPointerCapture(event.pointerId)
    resizeSession.current = {
      startX: event.clientX,
      rowWidth,
      columnIds: rowLayout.columnIds,
      initialWidths: rowLayout.widths,
      currentWidths: rowLayout.widths,
    }
    previewWidths(rowLayout.columnIds, rowLayout.widths)
  }

  const handleResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const session = resizeSession.current
    if (!session) return

    const deltaPercent =
      ((event.clientX - session.startX) / session.rowWidth) *
      ColumnLayoutRules.totalPercent
    const nextWidths = ColumnLayoutRules.resizeBoundary(
      session.initialWidths,
      columnIndex,
      deltaPercent,
    )
    session.currentWidths = nextWidths
    previewWidths(session.columnIds, nextWidths)
  }

  const handleResizePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const session = resizeSession.current
    if (!session) return

    resizeSession.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    commitRowWidths(editor, rowId, session.currentWidths)
    clearColumnWidthPreview()
  }

  const handleResizePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeSession.current) return

    resizeSession.current = null
    clearColumnWidthPreview()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
      !hasNextColumn ||
      columnIndex < 0
    ) {
      return
    }

    event.preventDefault()
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const step = event.shiftKey ? 5 : 1
    const nextWidths = ColumnLayoutRules.resizeBoundary(
      rowLayout.widths,
      columnIndex,
      direction * step,
    )
    commitRowWidths(editor, rowId, nextWidths)
  }

  const pairTotal = hasNextColumn
    ? storedWidth + (rowLayout.widths[columnIndex + 1] ?? 0)
    : storedWidth
  const columnStyle = {
    '--editor-column-width': `${width}%`,
  } as CSSProperties

  return (
    <NodeViewWrapper
      ref={columnElementRef}
      className="cubs-editor-column"
      style={columnStyle}
      data-editor-column=""
      data-column-id={columnId}
      data-column-width={width}
    >
      <EditorDropPlaceholder id={leftId} setNodeRef={leftDrop.setNodeRef} className="cubs-editor-column-drop-zone is-left" />
      <NodeViewContent className="cubs-editor-column-content" />
      <EditorDropPlaceholder id={rightId} setNodeRef={rightDrop.setNodeRef} className="cubs-editor-column-drop-zone is-right" />

      {hasNextColumn && (
        <button
          type="button"
          role="separator"
          aria-orientation="vertical"
          aria-label={i18n('pages.block-editor.editor.resize-linked-blocks')}
          aria-valuemin={ColumnLayoutRules.minimumPercent}
          aria-valuemax={pairTotal - ColumnLayoutRules.minimumPercent}
          aria-valuenow={width}
          contentEditable={false}
          className="cubs-editor-column-link"
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          onPointerCancel={handleResizePointerCancel}
          onKeyDown={handleResizeKeyDown}
        >
          <span aria-hidden="true" />
        </button>
      )}
    </NodeViewWrapper>
  )
}

export function EditableBlockView({ editor, getPos, node }: NodeViewProps) {
  const blockId = stringAttribute(node.attrs.id) ?? crypto.randomUUID()
  const kind = stringAttribute(node.attrs.kind) ?? 'richText'
  const formViewId = stringAttribute(node.attrs.formViewId)
  const environment = useEditorEnvironment()
  const form = kind === 'formSubmit'
    ? environment.forms.find((candidate) => candidate.viewId === formViewId)
    : undefined
  const resolved = resolvedPosition({ editor, getPos })
  const rowDepth = ancestorDepth(resolved, 'blockRow')
  const columnDepth = ancestorDepth(resolved, 'blockColumn')
  const rowNode = rowDepth === null || !resolved ? null : resolved.node(rowDepth)
  const columnNode = columnDepth === null || !resolved ? null : resolved.node(columnDepth)
  const columnIndex = rowDepth === null || !resolved ? -1 : resolved.index(rowDepth)
  const rowId = stringAttribute(rowNode?.attrs.id) ?? ''
  const columnId = stringAttribute(columnNode?.attrs.id) ?? ''
  const { active, activeNodeRect } = useDndContext()
  const {
    clearColumnWidthPreview,
  } = useEditorInteractions()
  const [layoutMenu, setLayoutMenu] = useState<{ left: number; top: number } | null>(null)
  const activeData = active?.data.current as EditorDragData | undefined
  const disabled = activeData?.blockId === blockId
  const beforeId = `item:${blockId}:before`
  const afterId = `item:${blockId}:after`
  const beforeTarget: EditorDropTarget = { type: 'item', blockId, edge: 'before' }
  const afterTarget: EditorDropTarget = { type: 'item', blockId, edge: 'after' }
  const beforeDrop = useDroppable({
    id: beforeId,
    data: beforeTarget,
    disabled,
  })
  const afterDrop = useDroppable({
    id: afterId,
    data: afterTarget,
    disabled,
  })
  const drag = useDraggable({
    id: `block:${blockId}`,
    data: {
      type: 'block',
      blockId,
      rowId,
      columnId,
      columnItemCount: columnNode?.childCount ?? 1,
      kind,
      text: node.textContent.slice(0, 120),
    } satisfies EditorDragData,
  })
  const dragStyle: CSSProperties = {
    ...(drag.isDragging ? dragPlaceholderStyle(activeNodeRect) : undefined),
    transform: drag.isDragging ? undefined : CSS.Translate.toString(drag.transform),
    transition: drag.isDragging
      ? undefined
      : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
  }
  const layoutItems: ContextMenuItem[] = ColumnLayoutRules.presets(
    rowNode?.childCount ?? 0,
  ).map((preset) => {
    const layout = ColumnLayoutRules.format(preset.widths)
    return {
      id: preset.id,
      icon: preset.equal ? 'lucide:columns-3' : 'lucide:panel-left',
      label: i18n(
        preset.equal
          ? 'pages.block-editor.editor.equal-columns'
          : 'pages.block-editor.editor.column-layout',
        { layout },
      ),
      onSelect: () => {
        commitRowWidths(
          editor,
          rowId,
          ColumnLayoutRules.anchor(preset.widths, columnIndex),
        )
        clearColumnWidthPreview()
      },
    }
  })

  const handleContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const block = event.currentTarget.closest<HTMLElement>('[data-editor-block]')
    const bounds = block?.getBoundingClientRect()
    const handleBounds = event.currentTarget.getBoundingClientRect()
    const clientX = event.clientX || handleBounds.left + handleBounds.width / 2
    const clientY = event.clientY || handleBounds.bottom
    setLayoutMenu({
      left: bounds ? clientX - bounds.left : 0,
      top: bounds ? clientY - bounds.top : event.currentTarget.offsetTop,
    })
  }

  return (
    <NodeViewWrapper
      ref={drag.setNodeRef}
      style={dragStyle}
      className={cn(
        'group/editor-block relative min-w-0',
        drag.isDragging && 'is-dragging',
      )}
      data-editor-block=""
      data-block-id={blockId}
      data-block-kind={kind}
      data-block-indent={node.attrs.indent ?? 0}
    >
      {drag.isDragging && <DragPlaceholder />}
      <EditorDropPlaceholder id={beforeId} setNodeRef={beforeDrop.setNodeRef} className="cubs-editor-item-drop-zone is-before" />
      <button
        ref={drag.setActivatorNodeRef}
        type="button"
        contentEditable={false}
        aria-label={i18n('pages.block-editor.editor.drag-block')}
        aria-haspopup="menu"
        aria-expanded={Boolean(layoutMenu)}
        className="cubs-editor-drag-handle"
        {...drag.attributes}
        {...drag.listeners}
        onPointerDownCapture={() => setLayoutMenu(null)}
        onClick={handleContextMenu}
        onContextMenu={handleContextMenu}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} aria-hidden="true" />
        ))}
      </button>
      {kind === 'formSubmit' ? (
        <div contentEditable={false} className="cubs-editor-block-content flex min-h-20 items-center justify-center rounded-xl border border-divider bg-contrast/35 p-4">
          <button
            type="button"
            disabled={!form}
            onClick={() => { if (form) environment.openForm(form.viewId) }}
            className="inline-flex items-center gap-2 rounded-lg bg-p-purple px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon={form?.icon ?? 'lucide:send'} className="size-4" />
            {form?.label ?? 'Formulário indisponível'}
          </button>
        </div>
      ) : <NodeViewContent className="cubs-editor-block-content min-h-9" />}
      <EditorDropPlaceholder id={afterId} setNodeRef={afterDrop.setNodeRef} className="cubs-editor-item-drop-zone is-after" />
      <div contentEditable={false} className="pointer-events-none absolute inset-0 z-50">
        <ContextMenu
          open={Boolean(layoutMenu)}
          onClose={() => setLayoutMenu(null)}
          items={layoutItems}
          className="pointer-events-auto mt-0"
          style={layoutMenu ?? undefined}
        />
      </div>
    </NodeViewWrapper>
  )
}

export function CalloutView() {
  return (
    <NodeViewWrapper
      as="aside"
      className="my-2 flex gap-3 rounded-md bg-p-purple-500/10 px-3 py-2.5"
      data-type="callout"
    >
      <span className="mt-0.5 shrink-0 text-p-purple" contentEditable={false}>
        <Icon icon="lucide:sparkles" fontSize={18} />
      </span>
      <NodeViewContent className="m-0 min-w-0 flex-1" />
    </NodeViewWrapper>
  )
}
