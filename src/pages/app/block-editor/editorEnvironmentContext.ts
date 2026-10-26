import { createContext, useContext } from 'react'
import type { RecursiveColumn, RecursiveRelation } from '@/shared/recursive-template'

export interface EditorEnvironmentValue {
  recursiveColumns?: RecursiveColumn[]
  recursiveRelations?: RecursiveRelation[]
  hasChildren?: boolean
}

export const EditorEnvironmentContext = createContext<EditorEnvironmentValue>({})

export function useEditorEnvironment() {
  return useContext(EditorEnvironmentContext)
}
