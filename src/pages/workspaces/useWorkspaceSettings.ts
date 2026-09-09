import { useContext } from 'react'

import { WorkspaceSettingsContext } from './workspaceSettingsContextValue'

export function useWorkspaceSettings() {
  const workspace = useContext(WorkspaceSettingsContext)
  if (!workspace) throw new Error('Configuração de workspace fora do provider.')
  return workspace
}
