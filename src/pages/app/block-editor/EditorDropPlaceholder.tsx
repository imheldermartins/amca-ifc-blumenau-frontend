import { useDndContext } from '@dnd-kit/core'
import { DragPlaceholder, dragPlaceholderStyle } from 'cubs-components'

import { useEditorInteractions } from './EditorInteractionContext'

/** Mantém o próprio droppable como slot, inclusive enquanto ele cresce. */
export function EditorDropPlaceholder({ id, className, setNodeRef }: {
  id: string
  className: string
  setNodeRef: (node: HTMLElement | null) => void
}) {
  const { activeNodeRect } = useDndContext()
  const { activeDropId } = useEditorInteractions()
  const targeted = activeDropId === id
  return <span
    ref={setNodeRef}
    contentEditable={false}
    className={`${className}${targeted ? ' is-over' : ''}`}
    style={targeted ? {
      ...dragPlaceholderStyle(activeNodeRect),
      minWidth: 0,
      maxWidth: className.includes('column-drop-zone') ? '50%' : '100%',
    } : undefined}
  >
    {targeted && <DragPlaceholder />}
  </span>
}
