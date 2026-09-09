import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceGeneralSettingsPage } from '@/pages/workspaces/WorkspaceGeneralSettingsPage'

export const Route = createFileRoute('/$lang/_private/workspaces/$workspaceId/settings/general')({
  component: WorkspaceGeneralSettingsPage,
})
