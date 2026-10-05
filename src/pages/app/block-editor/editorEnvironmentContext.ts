import { createContext, useContext } from 'react'
import type { CatalogIcon } from 'cubs-database'

export interface FormBlockOption {
  viewId: string
  label: string
  icon: CatalogIcon | null
}

export interface EditorEnvironmentValue {
  forms: FormBlockOption[]
  openForm: (viewId: string) => void
}

export const EditorEnvironmentContext = createContext<EditorEnvironmentValue>({
  forms: [],
  openForm: () => undefined,
})

export function useEditorEnvironment() {
  return useContext(EditorEnvironmentContext)
}
