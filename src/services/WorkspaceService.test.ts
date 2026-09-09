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

  it('mantém a key no corpo e nunca na URL', async () => {
    api.post.mockResolvedValue({ valid: true })
    await service.validateKey('cubs_ws_v1_secret', 'create')
    expect(api.post).toHaveBeenCalledWith('/workspaces/access-keys/validate', {
      key: 'cubs_ws_v1_secret',
      purpose: 'create',
    })
  })

  it('usa endpoints explícitos para lista, criação, entrada e roles', async () => {
    api.get.mockResolvedValue([])
    api.post.mockResolvedValue({})
    api.put.mockResolvedValue([])

    await service.listMine()
    await service.create({ name: 'Produto', key: 'key', organizationId: 'organization' })
    await service.join('key')
    await service.updateMemberRole('workspace', 'user', 'member')
    await service.listOrganizations()
    await service.createOrganization({ name: 'IFC', workspaceId: 'workspace' })
    await service.linkWorkspace('organization', 'workspace')
    await service.searchOrganizationWorkspaceUsers('organization', 'workspace', 'Ana Silva')
    await service.addOrganizationWorkspaceUser('organization', 'workspace', 'user')

    expect(api.get).toHaveBeenCalledWith('/workspaces')
    expect(api.post).toHaveBeenCalledWith('/workspaces', {
      name: 'Produto',
      key: 'key',
      organizationId: 'organization',
    })
    expect(api.post).toHaveBeenCalledWith('/workspaces/join', { key: 'key' })
    expect(api.put).toHaveBeenCalledWith('/workspaces/workspace/members/user/role', {
      role: 'member',
    })
    expect(api.get).toHaveBeenCalledWith('/organizations')
    expect(api.post).toHaveBeenCalledWith('/organizations', {
      name: 'IFC',
      workspaceId: 'workspace',
    })
    expect(api.put).toHaveBeenCalledWith(
      '/organizations/organization/workspaces/workspace',
      {},
    )
    expect(api.get).toHaveBeenCalledWith(
      '/organizations/organization/workspaces/workspace/users?q=Ana%20Silva',
    )
    expect(api.post).toHaveBeenCalledWith(
      '/organizations/organization/workspaces/workspace/users/user',
    )
  })
})
