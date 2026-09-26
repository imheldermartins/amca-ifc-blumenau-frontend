/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL completa da API HTTP (ex.: http://localhost:3000/api/v1). */
  readonly VITE_CUBS_API_URL?: string
  /** Override do socket.io — SÓ quando morar em outro servidor que não o da API. */
  readonly VITE_CUBS_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
