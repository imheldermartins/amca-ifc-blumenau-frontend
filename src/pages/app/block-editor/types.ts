import type { Editor } from '@tiptap/core'

export type EditorBlockKind =
  | 'richText'
  | 'bulletList'
  | 'enumerateList'
  | 'checkList'
  | 'image'

export interface EditorBlockActionProps {
  editor: Editor
  compact?: boolean
  onSelect?: () => void
}
