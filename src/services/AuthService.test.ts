import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  post: vi.fn(),
  postAsClient: vi.fn(),
  get: vi.fn(),
  refreshSession: vi.fn(),
}))
const session = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn() }))

vi.mock('@/services/ApiService', () => ({ apiService: api }))
vi.mock('@/services/sessionStore', () => ({ sessionStore: session }))

import { AuthService } from './AuthService'

const pending = {
  verificationRequired: true as const,
  email: 'helder@ifc.estudantes.edu.br',
  notificationPending: false,
}

beforeEach(() => vi.clearAllMocks())

describe('AuthService workspace registration', () => {
  const service = new AuthService()

  it('normaliza o cadastro comum sem criar sessão antes da validação', async () => {
    api.post.mockResolvedValue(pending)

    await expect(service.signUp({
      name: '  Helder Xavier  ',
      email: '  HELDER@ifc.estudantes.edu.br ',
      password: 'não-deve-ser-enviada',
      returnTo: '/pt-br/organizations/new',
    })).resolves.toEqual(pending)

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Helder Xavier',
      email: 'helder@ifc.estudantes.edu.br',
      returnTo: '/pt-br/organizations/new',
    })
    expect(session.set).not.toHaveBeenCalled()
  })

})
