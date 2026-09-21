import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$lang/_authenticated/workspaces')({
  component: Outlet,
})
