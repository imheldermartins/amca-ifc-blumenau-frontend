import { useLayoutEffect } from 'react'
import { Navigate, Outlet, createFileRoute, useParams } from '@tanstack/react-router'

import { useAuth } from '@/contexts/AuthContext'

/**
 * Layout público (pathless): agrupa login e os dois cadastros. Usuário já autenticado
 * não tem o que fazer aqui — vai ao seletor, que respeita sua preferência.
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

  // As telas públicas têm temas fixos (light no cadastro, purple no login),
  // sem alternância. A preferência continua intacta: ao sair daqui, o tema
  // anterior da área autenticada é restaurado.
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')

    return () => {
      root.classList.toggle('dark', wasDark)
    }
  }, [])

  // Enquanto confere a sessão, não decide: mostrar o login e depois pular para
  // a workspace (se houver sessão) seria um flash.
  if (!restoring && user) {
    return (
      <Navigate
        to="/$lang/workspaces"
        params={{ lang: lang ?? 'pt-br' }}
        search={{ choose: false, tab: 'workspaces' }}
      />
    )
  }

  return restoring ? null : <Outlet />
}
