import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceVariablesPage } from '@/pages/workspaces/WorkspaceVariablesPage'

export const Route = createFileRoute('/$lang/_authenticated/workspaces/$workspaceId/settings/variables')({
  component: WorkspaceVariablesPage,
})
