import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceMembersPage } from '@/pages/workspaces/WorkspaceMembersPage'

export const Route = createFileRoute('/$lang/_authenticated/workspaces/$workspaceId/settings/members')({
  component: WorkspaceMembersPage,
})
