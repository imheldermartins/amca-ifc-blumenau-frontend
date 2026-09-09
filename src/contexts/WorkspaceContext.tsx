import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { workspaceService, type ApiWorkspace } from '@/services/WorkspaceService'

export interface WorkspaceState {
  /** Id da workspace em foco, derivado da rota atual. */
  workspaceId: string | null
  /** Dados da workspace; `null` enquanto carrega ou se a leitura falhou. */
  workspace: ApiWorkspace | null
  loading: boolean
  failed: boolean
}

const WorkspaceContext = createContext<WorkspaceState | null>(null)

/**
 * Workspace atual do shell do app.
 *
 * O `workspaceId` vem de FORA (hoje, do parâmetro de rota) — o provider não
 * escolhe workspace, só carrega a que lhe deram. O fetch acontece no mount (ou
 * seja: ao carregar o layout) e o resultado fica em memória. O layout é
 * remontado quando o id da rota muda, isolando o estado entre workspaces.
 *
 * Só a IDENTIDADE da workspace mora aqui. O conteúdo — a base,
 * as colunas, as linhas — continua sendo carregado por quem desenha a página,
 * via `DatabaseService`, a partir do `workspaceId` que este contexto fornece.
 */
export function WorkspaceProvider({
  workspaceId,
  children,
}: {
  workspaceId: string | null
  children: ReactNode
}) {
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null)
  const [loading, setLoading] = useState(Boolean(workspaceId))
  const [failed, setFailed] = useState(false)

  // O flag `active` descarta a resposta de um unmount no meio do caminho — sem
  // ele, o setState cai num componente que já saiu da árvore.
  useEffect(() => {
    let active = true

    if (!workspaceId) {
      setWorkspace(null)
      setFailed(false)
      setLoading(false)
      return () => {
        active = false
      }
    }

    setLoading(true)
    setFailed(false)

    workspaceService
      .getWorkspace(workspaceId)
      .then((loaded) => {
        if (active) setWorkspace(loaded)
      })
      // O ApiService já logou o AppError; aqui só marca a falha para a UI
      // cair no rótulo de fallback em vez de ficar em "Carregando..." eterno.
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [workspaceId])

  const value = useMemo<WorkspaceState>(
    () => ({ workspaceId, workspace, loading, failed }),
    [workspaceId, workspace, loading, failed],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceState {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace precisa ser usado dentro de <WorkspaceProvider>.')
  }
  return context
}
