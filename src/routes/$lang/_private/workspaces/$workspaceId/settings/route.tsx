import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceSettingsLayout } from '@/pages/workspaces/WorkspaceSettingsLayout'

export const Route = createFileRoute('/$lang/_private/workspaces/$workspaceId/settings')({
  component: WorkspaceSettingsLayout,
})
