import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { workspaceService, type ApiWorkspace } from '@/services/WorkspaceService'

export interface WorkspaceState {
  /** Id da workspace em foco nesta aba. */
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
 * A rota `/workspace/:id` escolhe a workspace e a grava na sessão desta aba.
 * As demais rotas só consomem essa identidade; no primeiro acesso da aba, a
 * preferência persistida do usuário funciona como fallback.
 *
 * Só a IDENTIDADE da workspace mora aqui. O conteúdo — a base, as colunas e
 * as linhas — continua sendo carregado por quem desenha a página, via
 * `DatabaseService`, a partir do `pageId` canônico da URL. O contexto serve ao
 * shell (topbar/sidebar), nunca substitui a identidade da página consultada.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [workspaceId, setWorkspaceId] = useState<string | null>(() =>
    user ? currentWorkspaceSession.resolve(user.id) ?? null : null,
  )
  const [workspace, setWorkspace] = useState<ApiWorkspace | null>(null)
  const [loading, setLoading] = useState(Boolean(workspaceId))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const sync = () => {
      setWorkspaceId(user ? currentWorkspaceSession.resolve(user.id) ?? null : null)
    }
    sync()
    return currentWorkspaceSession.subscribe(sync)
  }, [user])

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
    setWorkspace(null)

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
