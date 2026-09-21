import { createFileRoute, redirect } from '@tanstack/react-router'

import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { databaseService } from '@/services/DatabaseService'

/**
 * Porta de entrada de uma workspace. Depois de resolver a página inicial da
 * membership, toda navegação passa a usar a identidade real `/page/:id`.
 */
export const Route = createFileRoute('/$lang/_authenticated/workspace/$workspaceId')({
  loader: async ({ context, params }) => {
    const page = await databaseService.getEntryPage(params.workspaceId)
    currentWorkspaceSession.set(context.user.id, params.workspaceId)
    throw redirect({
      to: '/$lang/page/$pageId',
      params: { lang: params.lang, pageId: page.id },
      search: {},
      replace: true,
    })
  },
})
