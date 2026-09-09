import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/_private/_app/myworkspace/$workspaceId')({
  component: Outlet,
})
