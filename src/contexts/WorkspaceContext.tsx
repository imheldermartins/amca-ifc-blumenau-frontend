import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { workspaceQueryKey } from '@/lib/workspaceQueryKeys'
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

  useEffect(() => {
    const sync = () => {
      setWorkspaceId(user ? currentWorkspaceSession.resolve(user.id) ?? null : null)
    }
    sync()
    return currentWorkspaceSession.subscribe(sync)
  }, [user])

  // Settings e o shell compartilham a mesma fonte de verdade. Assim, o
  // setQueryData feito depois de salvar nome/ícone atualiza imediatamente o
  // contexto global, mesmo quando o id da workspace não mudou.
  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey(user?.id ?? 'anonymous', workspaceId ?? 'none'),
    queryFn: () => {
      if (!workspaceId) throw new Error('Workspace atual não definida')
      return workspaceService.getWorkspace(workspaceId)
    },
    enabled: Boolean(user && workspaceId),
  })

  const value = useMemo<WorkspaceState>(
    () => ({
      workspaceId,
      workspace: workspaceQuery.data ?? null,
      loading: Boolean(workspaceId) && workspaceQuery.isPending,
      failed: Boolean(workspaceId) && workspaceQuery.isError,
    }),
    [workspaceId, workspaceQuery.data, workspaceQuery.isError, workspaceQuery.isPending],
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
