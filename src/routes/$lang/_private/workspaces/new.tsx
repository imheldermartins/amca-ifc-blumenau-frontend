import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceAccessPage } from '@/pages/workspaces/WorkspaceAccessPage'

export const Route = createFileRoute('/$lang/_private/workspaces/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: search.tab === 'join' ? 'join' as const : 'create' as const,
    ...(typeof search.organization === 'string' && { organization: search.organization }),
  }),
  component: WorkspaceAccessPage,
})
