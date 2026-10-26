import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Icon } from '@iconify/react'
import type { Editor } from '@tiptap/core'
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { i18n } from '@/lib/i18n'
import { handleCollisions } from '@/shared/dnd/dragAnchor'

import { editorBlockOptionForKind } from './blockCatalog'
import { moveBlockToDrop, type EditorDropTarget } from './blockLayout'
import { BLOCK_DRAG_ACTIVATION_CONSTRAINT } from './editorDndConfig'
import {
  EditorInteractionContext,
  type ColumnWidthPreview,
  type EditorInteractionState,
} from './EditorInteractionContext'

export interface EditorDragData {
  type: 'block'
  blockId: string
  rowId: string
  columnId: string
  columnItemCount: number
  kind: string
  text: string
}

interface EditorDndProps {
  editor: Editor
  children: ReactNode
}

function isDropTarget(value: unknown): value is EditorDropTarget {
  if (!value || typeof value !== 'object' || !('type' in value)) return false
  return value.type === 'row' || value.type === 'column' || value.type === 'item'
}

export const editorCollisionDetection: CollisionDetection = (args) => {
  const collisions = handleCollisions(args)
  // At a row boundary, create a full row even when a smaller block/column
  // hit area overlaps it. Away from that boundary, keep the existing targets.
  const rowBoundary = collisions.find((collision) =>
    collision.data?.value === 0 &&
    collision.data.droppableContainer.data.current?.type === 'row',
  )
  const nearest = rowBoundary ?? collisions[0]
  return nearest && (nearest.data?.value ?? Infinity) <= 48 ? [nearest] : []
}

export function EditorDnd({ editor, children }: EditorDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: BLOCK_DRAG_ACTIVATION_CONSTRAINT,
    }),
  )
  const [preview, setPreview] = useState<EditorDragData | null>(null)
  const [activeDropId, setActiveDropId] = useState<string | null>(null)
  const [columnWidthPreview, setColumnWidthPreviewState] = useState<Record<string, number>>({})
  const previewOption = preview ? editorBlockOptionForKind(preview.kind) : null

  const setColumnWidthPreview = useCallback((columns: readonly ColumnWidthPreview[]) => {
    setColumnWidthPreviewState(Object.fromEntries(
      columns.map(({ columnId, width }) => [columnId, width]),
    ))
  }, [])
  const clearColumnWidthPreview = useCallback(() => {
    setColumnWidthPreviewState({})
  }, [])
  const interactionState = useMemo<EditorInteractionState>(() => ({
    activeDropId,
    columnWidthPreview,
    clearColumnWidthPreview,
    setColumnWidthPreview,
  }), [
    activeDropId,
    clearColumnWidthPreview,
    columnWidthPreview,
    setColumnWidthPreview,
  ])

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveDropId(null)
    const data = active.data.current as EditorDragData | undefined
    if (data?.type === 'block') setPreview(data)
  }

  const handleDragOver = ({ over }: DragOverEvent) => {
    setActiveDropId(over ? String(over.id) : null)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setPreview(null)
    setActiveDropId(null)
    const activeData = active.data.current as EditorDragData | undefined
    const target = over?.data.current

    if (activeData?.type !== 'block' || !isDropTarget(target)) return

    const rows = moveBlockToDrop(editor.state.doc, activeData.blockId, target)
    if (!rows) return

    editor.view.dispatch(
      editor.state.tr.replaceWith(0, editor.state.doc.content.size, rows).scrollIntoView(),
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={editorCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={() => {
        setPreview(null)
        setActiveDropId(null)
      }}
      onDragEnd={handleDragEnd}
    >
      <EditorInteractionContext.Provider value={interactionState}>
        {children}
        <DragOverlay
          dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {preview && (
            <div className="cubs-editor-drag-preview">
              <span className="cubs-editor-drag-preview-icon" aria-hidden="true">
                <Icon icon={previewOption?.icon ?? 'lucide:box'} fontSize={20} />
              </span>
              <span className="min-w-0">
                <span className="cubs-editor-drag-preview-kind">
                  {previewOption ? i18n(previewOption.labelKey) : preview.kind}
                </span>
                <span className="cubs-editor-drag-preview-text">
                  {preview.text || i18n('pages.block-editor.editor.drag-preview-empty')}
                </span>
              </span>
            </div>
          )}
        </DragOverlay>
      </EditorInteractionContext.Provider>
    </DndContext>
  )
}
