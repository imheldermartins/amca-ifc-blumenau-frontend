import { useParams } from '@tanstack/react-router'

import { PageDatabaseView } from '@/pages/app/PageDatabaseView'

/**
 * Uma página aberta pelo id — minha ou compartilhada comigo. O id vem direto
 * da URL, sem workspace no meio: quem autoriza é o backend (dono OU membro,
 * herdado pela árvore de `page_edges`).
 */
export function PageRoutePage() {
  const { pageId } = useParams({ from: '/$lang/_private/page/$pageId' })

  return <PageDatabaseView pageId={pageId} />
}
