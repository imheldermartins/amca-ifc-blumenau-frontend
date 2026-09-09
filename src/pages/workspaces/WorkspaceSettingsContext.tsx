import type { ReactNode } from 'react'

import type { ApiWorkspace } from '@/services/WorkspaceService'
import { WorkspaceSettingsContext } from './workspaceSettingsContextValue'

export function WorkspaceSettingsProvider({
  workspace,
  children,
}: {
  workspace: ApiWorkspace
  children: ReactNode
}) {
  return (
    <WorkspaceSettingsContext.Provider value={workspace}>
      {children}
    </WorkspaceSettingsContext.Provider>
  )
}
