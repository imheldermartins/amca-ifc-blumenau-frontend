import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceSelectorPage } from '@/pages/workspaces/WorkspaceSelectorPage'

export const Route = createFileRoute('/$lang/_private/workspaces/')({
  validateSearch: (search: Record<string, unknown>) => ({
    choose: search.choose === true || search.choose === 'true',
    tab: search.tab === 'organization' ? 'organization' as const : 'workspaces' as const,
  }),
  component: WorkspaceSelectorPage,
})
