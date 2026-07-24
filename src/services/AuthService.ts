import { AppError } from '@/lib/errors'
import { apiService } from '@/services/ApiService'
import { sessionStore } from '@/services/sessionStore'

export interface AuthUser {
  /** ULID gerado pelo backend. */
  id: string
  name: string | null
  email: string
}

export interface SignUpInput {
  name: string
  email: string
  password: string
}

export interface SignInInput {
  email: string
  password: string
}

export class EmailInUseError extends Error {}
export class InvalidCredentialsError extends Error {}

/** `/auth/login` e `/auth/register`: o refresh vem no cookie, não aqui. */
interface SessionResponse {
  user: AuthUser
  accessToken: string
}

// O ApiService rejeita sempre AppError — o status HTTP já vem normalizado.
function hasStatus(error: unknown, status: number): boolean {
  return error instanceof AppError && error.status === status
}

/**
 * Autenticação contra a API do Cub's (backend Express, rotas `/auth`).
 *
 * O backend cuida do hash (bcrypt) e emite o par de tokens, mas eles vão para
 * lugares DIFERENTES de propósito:
 *
 *   - o refresh (7 dias) volta como cookie `HttpOnly` — nunca passa por aqui,
 *     nunca é lido por JavaScript;
 *   - o access (15 min) fica em memória (`sessionStore`).
 *
 * Nada é persistido no `localStorage`, nem os tokens nem o usuário. A
 * consequência prática é que um reload começa SEM sessão em memória, e é o
 * `restore()` que a reconstrói a partir do cookie — chamado UMA vez, no
 * `useEffect` do `AuthProvider` (não no guard de rota, que não faz fetch).
 */
export class AuthService {
  async signUp(input: SignUpInput): Promise<AuthUser> {
    try {
      const { user, accessToken } = await apiService.post<SessionResponse>('/auth/register', {
        name: input.name.trim() || null,
        email: input.email.trim().toLowerCase(),
        password: input.password,
      })
      sessionStore.set(accessToken)
      return user
    } catch (error) {
      if (hasStatus(error, 409)) {
        throw new EmailInUseError()
      }
      throw error
    }
  }

  async signIn(input: SignInInput): Promise<AuthUser> {
    try {
      // O login devolve o usuário JUNTO do access token. Antes vinham só os
      // tokens e o usuário saía de `GET /users` pegando o primeiro item —
      // contrato frágil, que dependia do backend escopar a listagem ao token.
      const { user, accessToken } = await apiService.post<SessionResponse>('/auth/login', {
        email: input.email.trim().toLowerCase(),
        password: input.password,
      })
      sessionStore.set(accessToken)
      return user
    } catch (error) {
      if (hasStatus(error, 401)) {
        throw new InvalidCredentialsError()
      }
      throw error
    }
  }

  /**
   * Encerra a sessão NO SERVIDOR. Não basta esquecer o token local: o refresh
   * é um bearer de 7 dias, e uma cópia vazada continuaria valendo. O backend
   * incrementa o `token_version` da conta, o que mata todos os refresh já
   * emitidos, e limpa o cookie.
   *
   * Nunca lança: a UI precisa deslogar mesmo se a rede falhar. Pior caso, a
   * sessão local morre e a do servidor expira sozinha.
   */
  async signOut(): Promise<void> {
    try {
      await apiService.postAsClient('/auth/logout')
    } catch {
      // Já logado pelo ApiService; o estado local é limpo de qualquer forma.
    } finally {
      sessionStore.clear()
    }
  }

  /**
   * Reconstrói a sessão a partir do cookie. Chamado UMA vez, pelo `useEffect`
   * do `AuthProvider` no boot — NÃO pelo guard de rota. Sessão não é realtime:
   * uma checagem no carregamento basta, sem refresh proativo a cada navegação.
   *
   * Duas idas: `/auth/refresh` troca o cookie por um access token novo, e
   * `/auth/me` diz de quem é. Sem cookie válido devolve `null` e o
   * `AuthProvider` deixa o `user` em null (o layout manda para o sign-in).
   */
  async restore(): Promise<AuthUser | null> {
    const refreshed = await apiService.refreshSession()
    if (!refreshed) return null

    try {
      return await apiService.get<AuthUser>('/auth/me')
    } catch {
      // Cookie válido mas usuário sumiu (conta apagada): não há sessão.
      sessionStore.clear()
      return null
    }
  }
}

export const authService = new AuthService()
