import { useEffect, useState } from 'react'

import { useWorkspace } from '@/contexts/WorkspaceContext'
import { PageDatabaseView } from '@/pages/app/PageDatabaseView'
import { databaseService } from '@/services/DatabaseService'

/**
 * Entrada pela workspace. A workspace NÃO é a unidade de trabalho — ela só
 * resolve o PONTO DE ENTRADA (`/workspaces/:id/page_root`, GET-or-create).
 * Com o id em mãos, o resto é idêntico a abrir qualquer página pelo
 * `/page/:id`: mesma view, mesma sala de realtime.
 */
export function WorkspaceEntryPage() {
  const { workspaceId } = useWorkspace()
  const [pageId, setPageId] = useState<string>()
  const [failed, setFailed] = useState(false)

  // O flag `active` descarta a resposta de um unmount no meio do caminho.
  useEffect(() => {
    let active = true

    setPageId(undefined)
    setFailed(false)
    databaseService
      .getEntryPage(workspaceId)
      .then((page) => {
        if (active) setPageId(page.id)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [workspaceId])

  return <PageDatabaseView pageId={pageId} failedToResolve={failed} />
}
