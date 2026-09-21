import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'

import { AccessRouteProvider, isAccessScope } from '@/contexts/AccessRouteContext'

export const Route = createFileRoute('/$lang/_authenticated/access/$scope/$scopeId')({
  beforeLoad: ({ params }) => {
    if (!isAccessScope(params.scope)) throw notFound()
  },
  component: AccessRouteLayout,
})

function AccessRouteLayout() {
  const { scope, scopeId } = Route.useParams()
  if (!isAccessScope(scope)) return null
  return (
    <AccessRouteProvider value={{ scope, id: scopeId }}>
      <Outlet />
    </AccessRouteProvider>
  )
}
