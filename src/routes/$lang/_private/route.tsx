import { Navigate, Outlet, createFileRoute, useParams } from '@tanstack/react-router'

import { useAuth } from '@/contexts/AuthContext'

/**
 * Área privada (pathless): exige autenticação; sem sessão, volta para o
 * sign-in. Os layouts filhos decidem se precisam do shell do app ou de uma
 * tela inteira, como o seletor e as configurações de workspace.
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

function PrivateLayout() {
  const { lang } = useParams({ strict: false })
  const { user, restoring } = useAuth()

  // Ainda conferindo a sessão do cookie: não monta nada e não redireciona —
  // sem isto, um usuário logado piscaria no sign-in antes de o refresh voltar.
  if (restoring) return null

  // Sessão confirmada como AUSENTE: fora daqui.
  if (!user) {
    return <Navigate to="/$lang/sign-in" params={{ lang: lang ?? 'pt-br' }} />
  }

  return <Outlet />
}
