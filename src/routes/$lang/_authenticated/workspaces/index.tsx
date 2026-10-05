import { createFileRoute, redirect } from '@tanstack/react-router'

import { workspacePreference } from '@/lib/workspacePreference'
import { WorkspaceSelectorPage } from '@/pages/workspaces/WorkspaceSelectorPage'

export const Route = createFileRoute('/$lang/_authenticated/workspaces/')({
  validateSearch: (search: Record<string, unknown>) => ({
    choose: search.choose === true || search.choose === 'true',
    tab: search.tab === 'organization' ? 'organization' as const : 'workspaces' as const,
  }),
  beforeLoad: ({ context, params, search }) => {
    if (search.choose) return
    const workspaceId = workspacePreference.get(context.user.id)
    if (!workspaceId) return

    throw redirect({
      to: '/$lang/workspace/$workspaceId',
      params: { lang: params.lang, workspaceId },
      search: {},
      replace: true,
    })
  },
  component: WorkspaceSelectorPage,
})
