import { createFileRoute, useLocation, useParams } from '@tanstack/react-router'

import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { readPageNavigationWorkspaceId } from '@/lib/pageNavigation'
import { AppLayout } from '@/pages/app/AppLayout'

export const Route = createFileRoute('/$lang/_private/_app')({
  component: AppRouteLayout,
})

function AppRouteLayout() {
  const { workspaceId } = useParams({ strict: false })
  const navigationWorkspaceId = useLocation({
    select: (location) => {
      const pageIdFromPath = location.pathname.match(/\/page\/([^/]+)$/)?.[1]
      const workspaceIdFromQuery = (location.search as Record<string, unknown>).workspace
      return typeof workspaceIdFromQuery === 'string'
        ? workspaceIdFromQuery
        : readPageNavigationWorkspaceId(location.state, pageIdFromPath)
    },
  })
  const currentWorkspaceId = typeof workspaceId === 'string'
    ? workspaceId
    : navigationWorkspaceId ?? null

  return (
    <WorkspaceProvider key={currentWorkspaceId ?? 'without-workspace'} workspaceId={currentWorkspaceId}>
      <AppLayout />
    </WorkspaceProvider>
  )
}
