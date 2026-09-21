import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

import type { AuthState } from '@/contexts/AuthContext'

export interface RouterContext {
  auth: AuthState
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Outlet />
      {/* Excluído automaticamente dos builds de produção. */}
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
