import { createFileRoute, redirect } from '@tanstack/react-router'

import { readAuthReturnTo } from '@/lib/authReturnTo'

/** Sign-in e sign-up só existem para quem ainda não possui sessão. */
export const Route = createFileRoute('/$lang/_public/_guest')({
  beforeLoad: async ({ context, location, params }) => {
    const user = await context.auth.ensureSession()
    if (!user) return

    const returnTo = readAuthReturnTo((location.search as Record<string, unknown>).returnTo)
    if (returnTo) throw redirect({ href: returnTo, replace: true })

    throw redirect({
      to: '/$lang/workspaces',
      params: { lang: params.lang },
      search: { choose: false, tab: 'workspaces' },
      replace: true,
    })
  },
})
