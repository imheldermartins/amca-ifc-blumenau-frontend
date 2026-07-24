import { Navigate, createFileRoute, useParams } from '@tanstack/react-router'

import { useAuth } from '@/contexts/AuthContext'
import { DEFAULT_WORKSPACE_ID, WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { AppLayout } from '@/pages/app/AppLayout'

/**
 * Área privada (pathless): exige autenticação; sem sessão, volta para o
 * sign-in. Agrupa TUDO que vive dentro do app — a workspace, uma página
 * qualquer (`/page/:id`, inclusive de outra pessoa) e a lista "Colaborando" —
 * para que a sidebar e o contexto de workspace existam UMA vez só.
 *
 * A proteção é REATIVA, não um `beforeLoad` que faz fetch. A sessão mora no
 * cookie `HttpOnly` (o JS não lê), então quem confere é o `AuthProvider` — um
 * `useEffect` que chama `restore()` UMA vez no boot. Aqui o layout só LÊ esse
 * estado: enquanto confere não decide nada, sem sessão manda para o sign-in,
 * com sessão monta o conteúdo. Nenhum refresh é disparado por navegação nem
 * pela tela de login.
 */
export const Route = createFileRoute('/$lang/_private')({
  component: PrivateLayout,
})

/**
 * O `WorkspaceProvider` entra aqui, e não no `main.tsx`, por dois motivos: o
 * fetch da workspace só faz sentido na área privada (só monta com sessão
 * confirmada, então a chamada nunca sai sem token), e o provider morre junto
 * com a rota — sair do app e voltar recarrega a workspace.
 *
 * `strict: false` porque `workspaceId` só existe na rota de workspace: em
 * `/page/:id` (que pode ser página de OUTRA pessoa) e em "Colaborando" não há
 * workspace na URL, e a minha continua sendo a padrão. O `key` remonta o
 * provider quando o id muda, para nenhum estado da workspace anterior
 * sobreviver à troca.
 */
function PrivateLayout() {
  const { lang, workspaceId } = useParams({ strict: false })
  const { user, restoring } = useAuth()

  // Ainda conferindo a sessão do cookie: não monta nada e não redireciona —
  // sem isto, um usuário logado piscaria no sign-in antes de o refresh voltar.
  if (restoring) return null

  // Sessão confirmada como AUSENTE: fora daqui.
  if (!user) {
    return <Navigate to="/$lang/sign-in" params={{ lang: lang ?? 'pt-br' }} />
  }

  const currentWorkspaceId = workspaceId ?? DEFAULT_WORKSPACE_ID
  return (
    <WorkspaceProvider key={currentWorkspaceId} workspaceId={currentWorkspaceId}>
      <AppLayout />
    </WorkspaceProvider>
  )
}
