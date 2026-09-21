import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { readAuthReturnTo } from '@/lib/authReturnTo'

/**
 * Layout pathless autenticado. O guard roda antes dos filhos e compartilha a
 * restauração única da sessão feita pelo AuthProvider.
 */
export const Route = createFileRoute('/$lang/_authenticated')({
  beforeLoad: async ({ context, location, params }) => {
    const user = await context.auth.ensureSession()
    if (!user) {
      throw redirect({
        to: '/$lang/sign-in',
        params: { lang: params.lang },
        search: { returnTo: readAuthReturnTo(location.href) },
        replace: true,
      })
    }
    return { user }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <WorkspaceProvider>
      <Outlet />
    </WorkspaceProvider>
  )
}
