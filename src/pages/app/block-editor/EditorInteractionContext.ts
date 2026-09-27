import { createContext, useContext } from 'react'

export interface ColumnWidthPreview {
  columnId: string
  width: number
}

export interface EditorInteractionState {
  activeDropId: string | null
  columnWidthPreview: Readonly<Record<string, number>>
  clearColumnWidthPreview: () => void
  setColumnWidthPreview: (columns: readonly ColumnWidthPreview[]) => void
}

export const EditorInteractionContext = createContext<EditorInteractionState | null>(null)

export function useEditorInteractions(): EditorInteractionState {
  const context = useContext(EditorInteractionContext)
  if (!context) {
    throw new Error('useEditorInteractions must be used inside EditorDnd')
  }
  return context
}
