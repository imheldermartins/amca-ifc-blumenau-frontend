import { createFileRoute, redirect } from '@tanstack/react-router'

import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { AppError } from '@/lib/errors'
import { workspacePreference } from '@/lib/workspacePreference'
import { databaseService } from '@/services/DatabaseService'

/**
 * Porta de entrada de uma workspace. Depois de resolver a página inicial da
 * membership, toda navegação passa a usar a identidade real `/page/:id`.
 */
export const Route = createFileRoute('/$lang/_authenticated/workspace/$workspaceId')({
  loader: async ({ context, params, preload }) => {
    const page = await databaseService.getEntryPage(params.workspaceId).catch((error: unknown) => {
      if (!(error instanceof AppError)
        || (error.status !== 403 && error.status !== 404)
        || workspacePreference.get(context.user.id) !== params.workspaceId) throw error

      if (!preload) workspacePreference.clear(context.user.id)
      throw redirect({
        to: '/$lang/workspaces',
        params: { lang: params.lang },
        search: { choose: true, tab: 'workspaces' },
        replace: true,
      })
    })
    if (!preload) currentWorkspaceSession.set(context.user.id, params.workspaceId)
    throw redirect({
      to: '/$lang/page/$pageId',
      params: { lang: params.lang, pageId: page.id },
      search: {},
      replace: true,
    })
  },
})
