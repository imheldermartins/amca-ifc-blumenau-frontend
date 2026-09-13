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
