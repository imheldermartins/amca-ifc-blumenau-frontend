import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))

vi.mock('@/services/ApiService', () => ({ apiService: api }))

import { SharedPagesService } from './SharedPagesService'

describe('SharedPagesService', () => {
  beforeEach(() => vi.resetAllMocks())

  it('lista os vínculos da página sem fabricar owner ou projeção visual', async () => {
    const collaborators = [
      {
        id: 'user-1',
        name: 'Ada Lovelace',
        email: 'ada@cubs.test',
      },
    ]
    api.get.mockResolvedValue(collaborators)

    await expect(new SharedPagesService().listCollaborators('page-1')).resolves.toBe(
      collaborators,
    )
    expect(api.get).toHaveBeenCalledWith('/pages/page-1/collaborators')
  })

  it('busca candidatos da workspace e adiciona à página', async () => {
    api.get.mockResolvedValue([])
    api.post.mockResolvedValue({ added: [], skipped: [] })
    const service = new SharedPagesService()

    await service.listCollaboratorCandidates('page-1', 'Ana Silva')
    await service.addCollaborator('page-1', 'user-1')

    expect(api.get).toHaveBeenCalledWith(
      '/pages/page-1/collaborator-candidates?q=Ana%20Silva',
    )
    expect(api.post).toHaveBeenCalledWith('/pages/page-1/collaborators', {
      userIds: ['user-1'],
    })
  })
})
