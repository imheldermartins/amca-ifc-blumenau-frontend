import { useEditorInteractions } from './EditorInteractionContext'

/** Absolute hit area; CSS draws only the insertion line or lateral highlight. */
export function EditorDropIndicator({ id, className, setNodeRef }: {
  id: string
  className: string
  setNodeRef: (node: HTMLElement | null) => void
}) {
  const { activeDropId } = useEditorInteractions()
  const targeted = activeDropId === id
  return <div
    ref={setNodeRef}
    contentEditable={false}
    className={`${className}${targeted ? ' is-over' : ''}`}
    aria-hidden="true"
    data-editor-drop-active={targeted || undefined}
  />
}
