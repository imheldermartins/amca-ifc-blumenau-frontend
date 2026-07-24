import { Navigate, Outlet, createFileRoute, useParams } from '@tanstack/react-router'

import { ThemeToggle } from '@components/ThemeToggle'
import { useAuth } from '@/contexts/AuthContext'
import { DEFAULT_WORKSPACE_ID } from '@/contexts/WorkspaceContext'

/**
 * Layout público (pathless): agrupa sign-in/sign-up. Usuário já autenticado
 * não tem o que fazer aqui — vai direto para a workspace padrão.
 *
 * Reativo, como o guard privado: lê o estado do `AuthProvider` (que confere a
 * sessão uma vez no boot) em vez de disparar refresh. A tela de login NÃO faz
 * fetch de sessão a cada visita — era isso que estourava o rate limit.
 */
export const Route = createFileRoute('/$lang/_public')({
  component: PublicLayout,
})

function PublicLayout() {
  const { lang } = useParams({ strict: false })
  const { user, restoring } = useAuth()

  // Enquanto confere a sessão, não decide: mostrar o login e depois pular para
  // a workspace (se houver sessão) seria um flash. Só o ThemeToggle aparece.
  if (!restoring && user) {
    return (
      <Navigate
        to="/$lang/myworkspace/$workspaceId"
        params={{ lang: lang ?? 'pt-br', workspaceId: DEFAULT_WORKSPACE_ID }}
      />
    )
  }

  return (
    <>
      <ThemeToggle className="fixed right-4 top-4 z-50" />
      {restoring ? null : <Outlet />}
    </>
  )
}
