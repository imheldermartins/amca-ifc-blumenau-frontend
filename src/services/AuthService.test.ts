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

const response = {
  user: { id: 'user-1', name: 'Helder Xavier', email: 'helder@ifc.estudantes.edu.br' },
  accessToken: 'access-token',
  workspace: { id: 'workspace-1', name: 'Área de Trabalho do Helder' },
}

beforeEach(() => vi.clearAllMocks())

describe('AuthService workspace registration', () => {
  const service = new AuthService()

  it('retém a workspace devolvida pelo cadastro comum e inicia a sessão', async () => {
    api.post.mockResolvedValue(response)

    await expect(service.signUp({
      name: '  Helder Xavier  ',
      email: '  HELDER@ifc.estudantes.edu.br ',
      password: 'secret1',
    })).resolves.toEqual({ user: response.user, workspace: response.workspace })

    expect(api.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Helder Xavier',
      email: 'helder@ifc.estudantes.edu.br',
      password: 'secret1',
    })
    expect(session.set).toHaveBeenCalledWith('access-token')
  })

  it('consulta a prévia sem expor a chave na URL', async () => {
    api.post.mockResolvedValue({
      valid: true,
      name: 'Helder',
      email: 'helder@ifc.estudantes.edu.br',
    })

    await service.previewWorkspaceKey('  cubs_ws_v1_secret  ')

    expect(api.post).toHaveBeenCalledWith('/auth/workspace-key/preview', {
      key: 'cubs_ws_v1_secret',
    })
  })

  it('normaliza o cadastro com chave e mantém o nome escolhido da workspace', async () => {
    api.post.mockResolvedValue(response)

    await expect(service.signUpWithWorkspace({
      key: '  cubs_ws_v1_secret ',
      name: '  Helder Xavier ',
      email: ' HELDER@ifc.estudantes.edu.br ',
      password: 'secret1',
      workspaceName: '  Laboratório IFC ',
    })).resolves.toEqual({ user: response.user, workspace: response.workspace })

    expect(api.post).toHaveBeenCalledWith('/auth/register/workspace', {
      key: 'cubs_ws_v1_secret',
      name: 'Helder Xavier',
      email: 'helder@ifc.estudantes.edu.br',
      password: 'secret1',
      workspaceName: 'Laboratório IFC',
    })
    expect(session.set).toHaveBeenCalledWith('access-token')
  })
})

