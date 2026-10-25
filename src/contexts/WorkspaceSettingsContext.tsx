import type { ReactNode } from 'react'

import { WorkspaceSettingsProvider as Provider } from '@/hooks/useWorkspaceSettings'
import type { ApiWorkspace } from '@/services/WorkspaceService'

export function WorkspaceSettingsProvider({
  workspace,
  children,
}: {
  workspace: ApiWorkspace
  children: ReactNode
}) {
  return (
    <Provider value={workspace}>
      {children}
    </Provider>
  )
}
