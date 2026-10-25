import { createContext, useContext } from 'react'

import type { ApiWorkspace } from '@/services/WorkspaceService'

const WorkspaceSettingsContext = createContext<ApiWorkspace | null>(null)
export const WorkspaceSettingsProvider = WorkspaceSettingsContext.Provider

export function useWorkspaceSettings() {
  const workspace = useContext(WorkspaceSettingsContext)
  if (!workspace) throw new Error('Configuração de workspace fora do provider.')
  return workspace
}
