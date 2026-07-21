import { createFileRoute, redirect, useParams } from '@tanstack/react-router'

import { DEFAULT_WORKSPACE_ID, WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { AppLayout } from '@/pages/app/AppLayout'
import { authService } from '@/services/AuthService'

/**
 * Área privada (pathless): exige autenticação; sem sessão, volta para o
 * sign-in. Agrupa TUDO que vive dentro do app — a workspace, uma página
 * qualquer (`/page/:id`, inclusive de outra pessoa) e a lista "Colaborando" —
 * para que o guard, a sidebar e o contexto de workspace existam UMA vez só.
 */
export const Route = createFileRoute('/$lang/_private')({
  beforeLoad: ({ params }) => {
    if (!authService.getStoredUser()) {
      throw redirect({ to: '/$lang/sign-in', params: { lang: params.lang } })
    }
  },
  component: PrivateLayout,
})

/**
 * O `WorkspaceProvider` entra aqui, e não no `main.tsx`, por dois motivos: o
 * fetch da workspace só faz sentido na área privada (o `beforeLoad` acima já
 * garantiu a sessão, então a chamada nunca sai sem token), e o provider morre
 * junto com a rota — sair do app e voltar recarrega a workspace.
 *
 * `strict: false` porque `workspaceId` só existe na rota de workspace: em
 * `/page/:id` (que pode ser página de OUTRA pessoa) e em "Colaborando" não há
 * workspace na URL, e a minha continua sendo a padrão. O `key` remonta o
 * provider quando o id muda, para nenhum estado da workspace anterior
 * sobreviver à troca.
 */
function PrivateLayout() {
  const { workspaceId } = useParams({ strict: false })
  const currentWorkspaceId = workspaceId ?? DEFAULT_WORKSPACE_ID

  return (
    <WorkspaceProvider key={currentWorkspaceId} workspaceId={currentWorkspaceId}>
      <AppLayout />
    </WorkspaceProvider>
  )
}
