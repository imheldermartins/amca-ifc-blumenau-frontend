import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadConnection() {
  vi.resetModules()
  return (await import('./connection')).connection
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('connection', () => {
  it('usa a base versionada de mesma origem quando a env não está definida', async () => {
    vi.stubEnv('VITE_CUBS_API_URL', '')
    vi.stubEnv('VITE_CUBS_SOCKET_URL', '')

    await expect(loadConnection()).resolves.toEqual({
      apiBaseUrl: '/api/v1',
      socketUrl: undefined,
    })
  })

  it('usa a base completa da env e entrega somente a origem ao socket', async () => {
    vi.stubEnv('VITE_CUBS_API_URL', '  http://localhost:3000/api/v1/  ')
    vi.stubEnv('VITE_CUBS_SOCKET_URL', '')

    await expect(loadConnection()).resolves.toEqual({
      apiBaseUrl: 'http://localhost:3000/api/v1',
      socketUrl: 'http://localhost:3000',
    })
  })

  it('respeita uma URL explícita e normalizada para o socket', async () => {
    vi.stubEnv('VITE_CUBS_API_URL', 'https://api.cubs.example/api/v1')
    vi.stubEnv('VITE_CUBS_SOCKET_URL', ' https://realtime.cubs.example/ ')

    await expect(loadConnection()).resolves.toEqual({
      apiBaseUrl: 'https://api.cubs.example/api/v1',
      socketUrl: 'https://realtime.cubs.example',
    })
  })
})
