import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceAccessPage } from '@/pages/workspaces/WorkspaceAccessPage'

export const Route = createFileRoute('/$lang/_authenticated/workspaces/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    ...(typeof search.organization === 'string' && { organization: search.organization }),
  }),
  component: WorkspaceAccessPage,
})
