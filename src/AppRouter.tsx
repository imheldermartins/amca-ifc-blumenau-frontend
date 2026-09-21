import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { router } from '@/router'

export function AppRouter() {
  const auth = useAuth()

  // O contexto do router é reavaliado quando a sessão termina de restaurar,
  // entra ou sai. Isso faz os beforeLoad reagirem também a login/logout.
  useEffect(() => {
    if (!auth.restoring) void router.invalidate()
  }, [auth.restoring, auth.user?.id])

  return <RouterProvider router={router} context={{ auth }} />
}
