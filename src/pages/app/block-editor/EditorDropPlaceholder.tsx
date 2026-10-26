import { useEditorInteractions } from './EditorInteractionContext'

/** The measured dropzone stays in place; its indicator never changes the document layout. */
export function EditorDropPlaceholder({ id, className, setNodeRef }: {
  id: string
  className: string
  setNodeRef: (node: HTMLElement | null) => void
}) {
  const { activeDropId } = useEditorInteractions()
  const targeted = activeDropId === id
  return <span
    ref={setNodeRef}
    contentEditable={false}
    className={`${className}${targeted ? ' is-over' : ''}`}
    aria-hidden="true"
    data-editor-drop-active={targeted || undefined}
  />
}
