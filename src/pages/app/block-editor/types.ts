import type { Editor } from '@tiptap/core'

export type EditorBlockKind =
  | 'richText'
  | 'bulletList'
  | 'enumerateList'
  | 'checkList'
  | 'image'
  | 'mathBlock'
  | 'codeBlock'
  | 'tableRecursive'
  | 'calendarRecursive'

export interface EditorBlockActionProps {
  editor: Editor
  compact?: boolean
  onSelect?: () => void
}
