/**
 * Ponto único de configuração das conexões com o backend do Cub's.
 *
 * IMPORTANTE: a API HTTP e o socket.io são o MESMO servidor — o socket.io
 * "pega carona" no http.Server do express (mesma origem, mesma porta). O que
 * muda é o protocolo da conversa:
 *
 *   - API:    requisições HTTP normais (axios) em http://host:porta/...
 *   - Socket: o handshake começa em HTTP e sofre upgrade para WebSocket no
 *     caminho /socket.io. Por isso a URL do socket.io usa esquema http(s)://
 *     — o upgrade para ws:// acontece por dentro (o client até aceita ws://
 *     e normaliza, mas o canônico é http).
 *
 * Resolução (em ordem):
 *   1. `VITE_CUBS_SOCKET_URL` — só defina se um dia o socket morar em OUTRO
 *      servidor que não o da API (hoje não é o caso).
 *   2. `VITE_CUBS_API_URL` — base URL HTTP completa, incluindo a versão da API
 *      (ex.: `http://localhost:3000/api/v1`). O socket herda somente a origem.
 *   3. Sem env nenhuma (dev): tudo passa pelo proxy do Vite — a API em
 *      `/api/v1` e o socket na própria origem (`/socket.io`), ambos
 *      repassados para o backend (ver `vite.config.ts`).
 *
 * O socket.io NÃO leva o prefixo: ele vive em `/socket.io` na raiz do backend,
 * fora dos routers de API.
 */
function normalizeBaseUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\/+$/, '')
  return normalized || undefined
}

function readOrigin(baseUrl: string): string | undefined {
  if (baseUrl.startsWith('/')) return undefined

  try {
    return new URL(baseUrl).origin
  } catch {
    return undefined
  }
}

const configuredApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_CUBS_API_URL)
const configuredSocketUrl = normalizeBaseUrl(import.meta.env.VITE_CUBS_SOCKET_URL)
const apiBaseUrl = configuredApiBaseUrl ?? '/api/v1'

export const connection = {
  /**
   * Base URL final do axios. Quando a env existe, ela já contém todo o caminho
   * público da API; sem env, `/api/v1` usa o proxy de mesma origem.
   */
  apiBaseUrl,
  /**
   * URL do socket.io. `undefined` = conectar na própria origem da página
   * (o proxy do Vite repassa /socket.io para o backend em dev).
   */
  socketUrl: configuredSocketUrl ?? (configuredApiBaseUrl ? readOrigin(configuredApiBaseUrl) : undefined),
} as const
