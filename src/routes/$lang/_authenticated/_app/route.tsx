import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from './-components/AppLayout'

export const Route = createFileRoute('/$lang/_authenticated/_app')({
  component: AppRouteLayout,
})

function AppRouteLayout() {
  return <AppLayout />
}
