import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceSettingsLayout } from '@/pages/workspaces/WorkspaceSettingsLayout'

export const Route = createFileRoute('/$lang/_authenticated/workspaces/$workspaceId/settings')({
  component: SettingsRoute,
})

function SettingsRoute() {
  const { workspaceId } = Route.useParams()
  return <WorkspaceSettingsLayout workspaceId={workspaceId} />
}
