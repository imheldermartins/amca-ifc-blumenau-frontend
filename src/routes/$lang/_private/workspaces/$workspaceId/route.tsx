import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/_private/workspaces/$workspaceId')({
  component: Outlet,
})
