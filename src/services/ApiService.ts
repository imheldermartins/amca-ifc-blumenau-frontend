import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios'

import { connection } from '@/lib/connection'
import { reportError, toAppError } from '@/lib/errors'
import { sessionStore } from '@/services/sessionStore'

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

/**
 * Header que identifica o cliente nas rotas autenticadas por COOKIE
 * (`/auth/refresh` e `/auth/logout`). É a guarda de CSRF: um `<form>` de outro
 * site não consegue definir header nenhum, e um `fetch()` que tente dispara
 * preflight — que morre no CORS de origem explícita do backend. Espelha
 * `core/http/csrf-guard.ts` lá.
 */
const CLIENT_HEADER = { 'X-Cubs-Client': 'web' }

export interface RefreshResponse {
  accessToken: string
}

/**
 * Cliente HTTP da API do Cub's (backend Express).
 *
 * A origem vem de `src/lib/connection.ts` (env `VITE_CUBS_API_URL`, ou o
 * proxy `/api` do Vite em dev). O access token (JWT) é anexado em toda
 * requisição a partir da MEMÓRIA (`sessionStore`); num 401, tenta renovar uma
 * única vez via `POST /auth/refresh` e refaz a requisição original. O refresh
 * é "single-flight": vários 401 simultâneos aguardam a MESMA chamada de
 * refresh (evita rotacionar o refresh token N vezes em paralelo).
 *
 * `withCredentials: true` é o que faz o cookie de sessão acompanhar as
 * chamadas — sem ele o `/auth/refresh` chega sem credencial e o login não
 * sobrevive ao primeiro F5.
 *
 * Toda falha sai daqui como `AppError` (scope 'api'), já logada no formato
 * padrão do projeto — consumidores tratam `error.status`, não o axios cru.
 */
export class ApiService {
  private readonly http: AxiosInstance
  private refreshInFlight: Promise<string> | null = null

  constructor() {
    this.http = axios.create({
      baseURL: connection.apiBaseUrl,
      timeout: 10_000,
      // O cookie `HttpOnly` do refresh só viaja com isto ligado.
      withCredentials: true,
    })

    this.http.interceptors.request.use((config) => {
      const accessToken = sessionStore.get()
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
      }
      return config
    })

    this.http.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as RetriableConfig | undefined
        const isRefreshCall = original?.url?.includes('/auth/refresh')

        // Sem checar token aqui: a credencial do refresh é o COOKIE, que o
        // JavaScript não consegue ver. Só tentamos e deixamos o backend
        // responder — 401 significa "não há sessão", e aí não há o que fazer.
        if (error.response?.status === 401 && original && !original._retried && !isRefreshCall) {
          original._retried = true
          try {
            const accessToken = await this.refreshTokens()
            original.headers.Authorization = `Bearer ${accessToken}`
            return this.http(original)
          } catch {
            sessionStore.clear()
          }
        }

        // "Não há sessão" não é erro: todo visitante deslogado que abre o
        // sign-in passa por aqui (o guard de rota tenta restaurar antes de
        // decidir). Logar isso encheria o console de vermelho num caminho
        // perfeitamente normal — então rejeita sem alarde, e quem chamou
        // trata o `null`.
        if (isRefreshCall && error.response?.status === 401) {
          return Promise.reject(toAppError('api', error))
        }

        // Padroniza: loga uma vez e rejeita como AppError.
        return Promise.reject(reportError('api', error))
      },
    )
  }

  private refreshTokens(): Promise<string> {
    // Reaproveita o refresh em andamento, se houver (single-flight).
    this.refreshInFlight ??= this.http
      .post<RefreshResponse>('/auth/refresh', null, { headers: CLIENT_HEADER })
      .then(({ data }) => {
        sessionStore.set(data.accessToken)
        return data.accessToken
      })
      .finally(() => {
        this.refreshInFlight = null
      })
    return this.refreshInFlight
  }

  /**
   * Força a renovação do access token fora do fluxo de uma requisição. Dois
   * usos: o `SocketService` quando o handshake toma "Não autorizado" (token
   * expirado) e o `AuthService.restore()` no boot do app, quando a memória
   * está vazia e só o cookie sabe que há sessão. Compartilha o mesmo
   * single-flight.
   */
  async refreshSession(): Promise<boolean> {
    try {
      await this.refreshTokens()
      return true
    } catch {
      sessionStore.clear()
      return false
    }
  }

  get<T>(url: string): Promise<T> {
    return this.http.get<T>(url).then((response) => response.data)
  }

  post<T>(url: string, body?: unknown): Promise<T> {
    return this.http.post<T>(url, body).then((response) => response.data)
  }

  put<T>(url: string, body?: unknown): Promise<T> {
    return this.http.put<T>(url, body).then((response) => response.data)
  }

  delete<T>(url: string): Promise<T> {
    return this.http.delete<T>(url).then((response) => response.data)
  }

  /** POST que carrega o header de cliente — só para as rotas de cookie. */
  postAsClient<T>(url: string, body?: unknown): Promise<T> {
    return this.http
      .post<T>(url, body, { headers: CLIENT_HEADER })
      .then((response) => response.data)
  }
}

export const apiService = new ApiService()
