import { createFileRoute, redirect } from '@tanstack/react-router'

import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { findPageWorkspace } from '@/lib/pageWorkspace'
import { PageRoutePage } from '@/pages/app/PageRoutePage'
import { databaseService } from '@/services/DatabaseService'
import { workspaceService } from '@/services/WorkspaceService'

export const Route = createFileRoute('/$lang/_authenticated/_app/page/$pageId')({
  beforeLoad: async ({ context, location, params }) => {
    const search = location.search as Record<string, unknown>
    const hasLegacyWorkspace = Object.prototype.hasOwnProperty.call(search, 'workspace')

    // A página é a autoridade para o contexto da workspace. Não basta confiar
    // na sessão existente: a mesma aba pode navegar de uma workspace para
    // outra por um deep-link. Revalidar a cadeia a cada troca de página evita
    // que o shell permaneça exibindo a workspace anterior.
    const [workspaces, breadcrumbs] = await Promise.all([
      workspaceService.listMine(),
      databaseService.getBreadcrumb(params.pageId),
    ])
    const workspace = findPageWorkspace(workspaces, params.pageId, breadcrumbs)
    if (workspace) currentWorkspaceSession.set(context.user.id, workspace.id)

    // Migração de URLs antigas: `workspace` nunca define o contexto. O valor
    // é descartado depois que a árvore da página foi resolvida.
    if (hasLegacyWorkspace) {
      const { workspace: _workspace, ...canonicalSearch } = search
      throw redirect({
        to: '/$lang/page/$pageId',
        params: { lang: params.lang, pageId: params.pageId },
        search: canonicalSearch,
        replace: true,
      })
    }
  },
  component: PageRoute,
})

function PageRoute() {
  const { pageId } = Route.useParams()
  return <PageRoutePage pageId={pageId} />
}
