import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceEntryPage } from '@/pages/app/WorkspaceEntryPage'

export const Route = createFileRoute('/$lang/_private/_app/myworkspace/$workspaceId/')({
  component: WorkspaceEntryPage,
})
