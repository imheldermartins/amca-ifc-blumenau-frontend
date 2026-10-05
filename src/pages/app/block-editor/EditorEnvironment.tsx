import type { ReactNode } from 'react'

import { EditorEnvironmentContext, type EditorEnvironmentValue } from './editorEnvironmentContext'

export function EditorEnvironmentProvider({ value, children }: { value: EditorEnvironmentValue; children: ReactNode }) {
  return <EditorEnvironmentContext.Provider value={value}>{children}</EditorEnvironmentContext.Provider>
}
