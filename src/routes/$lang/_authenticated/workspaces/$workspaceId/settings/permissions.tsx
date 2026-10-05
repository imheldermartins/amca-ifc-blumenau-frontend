import { createFileRoute } from '@tanstack/react-router'
import { WorkspacePermissionsPage } from '@/pages/workspaces/WorkspacePermissionsPage'
export const Route = createFileRoute('/$lang/_authenticated/workspaces/$workspaceId/settings/permissions')({
  validateSearch: (search: Record<string, unknown>) => ({ role: typeof search.role === 'string' ? search.role : undefined }),
  component: WorkspacePermissionsPage,
})
