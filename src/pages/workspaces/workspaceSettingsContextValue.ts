import { createContext } from 'react'

import type { ApiWorkspace } from '@/services/WorkspaceService'

export const WorkspaceSettingsContext = createContext<ApiWorkspace | null>(null)
