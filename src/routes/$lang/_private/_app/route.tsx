import { createFileRoute } from '@tanstack/react-router'
import { AppLayout } from '@/pages/app/AppLayout'

export const Route = createFileRoute('/$lang/_private/_app')({
  component: AppRouteLayout,
})

function AppRouteLayout() {
  return <AppLayout />
}
