import { useLocation } from '@tanstack/react-router'

import { readPageNavigationTitle } from '@/lib/pageNavigation'
import { PageDatabaseView } from '@/pages/app/PageDatabaseView'

/**
 * Uma página aberta pelo id — minha ou compartilhada comigo. O id vem direto
 * da URL, sem workspace no meio: quem autoriza é o backend (dono OU membro,
 * herdado pela árvore de `page_edges`).
 */
export function PageRoutePage({ pageId }: { pageId: string }) {
  const initialTitle = useLocation({
    select: (location) => readPageNavigationTitle(location.state, pageId),
  })

  return <PageDatabaseView key={pageId} pageId={pageId} initialTitle={initialTitle} />
}
