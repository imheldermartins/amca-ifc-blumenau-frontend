import type { ScopeAccess } from './AccessService'
import { apiService } from '@/services/ApiService'
import type { WorkspaceRole } from '@/lib/workspaceAbility'

export type WorkspaceIcon = `${'cuida' | 'lucide'}:${string}`

export interface ApiWorkspace extends Partial<ScopeAccess> {
  id: string
  name: string | null
  data: Record<string, unknown>
  organizationId: string | null
  organizationName: string | null
  isPersonal: boolean
  icon: WorkspaceIcon
  createdByUserId: string | null
  owner: { id: string | null; name: string | null; email: string | null }
  role: WorkspaceRole
  pageRootId: string
}

export interface ApiWorkspaceMember {
  id: string
  name: string | null
  email: string
  role: WorkspaceRole
  pageRootId: string
}

export interface ApiOrganization extends Partial<ScopeAccess> {
  id: string
  name: string
  data: Record<string, unknown>
  role: WorkspaceRole
  workspaceCount: number
}

export interface ApiOrganizationWorkspace {
  id: string
  name: string | null
  icon: string | null
  canEnter: boolean
  isMember: boolean
}

export class WorkspaceService {
  listMine(): Promise<ApiWorkspace[]> {
    return apiService.get<ApiWorkspace[]>('/workspaces')
  }

  getWorkspace(workspaceId: string): Promise<ApiWorkspace> {
    return apiService.get<ApiWorkspace>(`/workspaces/${workspaceId}`)
  }

  create(input: { name: string; organizationId: string }): Promise<ApiWorkspace> {
    return apiService.post<ApiWorkspace>('/workspaces', input)
  }

  update(
    workspaceId: string,
    input: { name: string; icon: WorkspaceIcon },
  ): Promise<ApiWorkspace> {
    return apiService.put<ApiWorkspace>(`/workspaces/${workspaceId}`, input)
  }

  listMembers(workspaceId: string): Promise<ApiWorkspaceMember[]> {
    return apiService.get<ApiWorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
  }

  setVariable(workspaceId: string, key: string, value: string | null): Promise<ApiWorkspace> {
    return apiService.patch<ApiWorkspace>(`/workspaces/${workspaceId}/variables`, { key, value })
  }

  updateMemberRole(
    workspaceId: string,
    userId: string,
    roleId: string,
  ): Promise<ApiWorkspaceMember[]> {
    return apiService.put<ApiWorkspaceMember[]>(
      `/workspaces/${workspaceId}/members/${userId}/role`,
      { roleId },
    )
  }

  listOrganizations(): Promise<ApiOrganization[]> {
    return apiService.get<ApiOrganization[]>('/organizations')
  }

  getOrganization(id: string): Promise<ApiOrganization> { return apiService.get(`/organizations/${id}`) }
  updateOrganization(id: string, name: string): Promise<ApiOrganization> { return apiService.put(`/organizations/${id}`, { name }) }
  organizationWorkspaces(id: string): Promise<ApiOrganizationWorkspace[]> { return apiService.get(`/organizations/${id}/workspaces`) }
  setOrganizationVariable(id: string, key: string, value: string | null): Promise<ApiOrganization> {
    return apiService.patch(`/organizations/${id}/variables`, { key, value })
  }

  createOrganization(input: { name: string }): Promise<ApiOrganization> {
    return apiService.post<ApiOrganization>('/organizations', input)
  }

  linkWorkspace(organizationId: string, workspaceId: string): Promise<ApiWorkspace> {
    return apiService.put<ApiWorkspace>(
      `/organizations/${organizationId}/workspaces/${workspaceId}`,
      {},
    )
  }


}

export const workspaceService = new WorkspaceService()
