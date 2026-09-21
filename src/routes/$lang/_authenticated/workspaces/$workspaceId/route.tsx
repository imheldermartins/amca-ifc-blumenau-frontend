import { Outlet, createFileRoute } from '@tanstack/react-router'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'

export const Route = createFileRoute('/$lang/_authenticated/workspaces/$workspaceId')({
  beforeLoad: ({ context, params }) => {
    currentWorkspaceSession.set(context.user.id, params.workspaceId)
  },
  component: Outlet,
})
