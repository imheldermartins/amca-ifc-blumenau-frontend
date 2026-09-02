import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn() }))

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
})
