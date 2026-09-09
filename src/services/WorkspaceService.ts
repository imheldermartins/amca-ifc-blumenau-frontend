import { apiService } from '@/services/ApiService'
import type { WorkspaceRole } from '@/lib/workspaceAbility'

export type WorkspaceIcon = `${'cuida' | 'lucide'}:${string}`
export type WorkspaceKeyPurpose = 'create' | 'join'

export interface ApiWorkspace {
  id: string
  name: string | null
  data: Record<string, unknown>
  organizationId: string | null
  organizationName: string | null
  icon: WorkspaceIcon
  createdByUserId: string | null
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

export interface WorkspaceKeyValidation {
  valid: boolean
  purpose?: WorkspaceKeyPurpose
  role?: WorkspaceRole
  workspace?: { id: string; name: string | null }
}

export interface ApiOrganization {
  id: string
  name: string
  data: Record<string, unknown>
  role: WorkspaceRole
  workspaceCount: number
}

export interface ApiOrganizationWorkspaceUser {
  id: string
  name: string | null
  email: string
  organizationRole: WorkspaceRole | null
  workspaceRole: WorkspaceRole | null
}

export class WorkspaceService {
  listMine(): Promise<ApiWorkspace[]> {
    return apiService.get<ApiWorkspace[]>('/workspaces')
  }

  getWorkspace(workspaceId: string): Promise<ApiWorkspace> {
    return apiService.get<ApiWorkspace>(`/workspaces/${workspaceId}`)
  }

  validateKey(key: string, purpose: WorkspaceKeyPurpose): Promise<WorkspaceKeyValidation> {
    return apiService.post<WorkspaceKeyValidation>('/workspaces/access-keys/validate', {
      key,
      purpose,
    })
  }

  create(input: { name: string; key: string; organizationId?: string }): Promise<ApiWorkspace> {
    return apiService.post<ApiWorkspace>('/workspaces', input)
  }

  join(key: string): Promise<ApiWorkspace> {
    return apiService.post<ApiWorkspace>('/workspaces/join', { key })
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

  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<ApiWorkspaceMember[]> {
    return apiService.put<ApiWorkspaceMember[]>(
      `/workspaces/${workspaceId}/members/${userId}/role`,
      { role },
    )
  }

  listOrganizations(): Promise<ApiOrganization[]> {
    return apiService.get<ApiOrganization[]>('/organizations')
  }

  createOrganization(input: { name: string; workspaceId: string }): Promise<ApiOrganization> {
    return apiService.post<ApiOrganization>('/organizations', input)
  }

  linkWorkspace(organizationId: string, workspaceId: string): Promise<ApiWorkspace> {
    return apiService.put<ApiWorkspace>(
      `/organizations/${organizationId}/workspaces/${workspaceId}`,
      {},
    )
  }

  searchOrganizationWorkspaceUsers(
    organizationId: string,
    workspaceId: string,
    query: string,
  ): Promise<ApiOrganizationWorkspaceUser[]> {
    return apiService.get<ApiOrganizationWorkspaceUser[]>(
      `/organizations/${organizationId}/workspaces/${workspaceId}/users?q=${encodeURIComponent(query)}`,
    )
  }

  addOrganizationWorkspaceUser(
    organizationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ApiOrganizationWorkspaceUser> {
    return apiService.post<ApiOrganizationWorkspaceUser>(
      `/organizations/${organizationId}/workspaces/${workspaceId}/users/${userId}`,
    )
  }
}

export const workspaceService = new WorkspaceService()
