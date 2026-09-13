import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}))
vi.mock('@/services/ApiService', () => ({ apiService: api }))

import { WorkspaceService } from './WorkspaceService'

beforeEach(() => vi.clearAllMocks())

describe('WorkspaceService', () => {
  const service = new WorkspaceService()

  it('usa endpoints explícitos para lista, criação e roles', async () => {
    api.get.mockResolvedValue([])
    api.post.mockResolvedValue({})
    api.put.mockResolvedValue([])

    await service.listMine()
    await service.create({ name: 'Produto', organizationId: 'organization' })
    await service.updateMemberRole('workspace', 'user', 'role-id')
    await service.listOrganizations()
    await service.createOrganization({ name: 'IFC' })
    await service.linkWorkspace('organization', 'workspace')

    expect(api.get).toHaveBeenCalledWith('/workspaces')
    expect(api.post).toHaveBeenCalledWith('/workspaces', {
      name: 'Produto',
      organizationId: 'organization',
    })
    expect(api.put).toHaveBeenCalledWith('/workspaces/workspace/members/user/role', {
      roleId: 'role-id',
    })
    expect(api.get).toHaveBeenCalledWith('/organizations')
    expect(api.post).toHaveBeenCalledWith('/organizations', {
      name: 'IFC',
    })
    expect(api.put).toHaveBeenCalledWith(
      '/organizations/organization/workspaces/workspace',
      {},
    )

  })
})
