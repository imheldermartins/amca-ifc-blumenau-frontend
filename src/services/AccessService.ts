import { apiService } from './ApiService'
export type AccessScope = 'organization' | 'workspace' | 'page'
export interface Permissions { read: string[]; write: string[] }
export interface ScopeAccess { scope: AccessScope; scopeId: string; ownerId: string | null; isOwner: boolean; isMember: boolean; roleId: string | null; roleName: string | null; permissions: Permissions }
export interface AccessRole { id: string; name: string; roles: Permissions; isDefault: boolean; systemKey: string | null; created_at: string; updated_at: string; workspaceId?: string; workspaceName?: string | null }
export interface AccessMember { id: string; membershipId: string; name: string | null; email: string; roleId: string | null; roleName: string | null; permissions: Permissions; access?: ScopeAccess }
export interface MembershipRequest { id: string; requesterId: string; requesterName: string | null; requesterEmail: string; status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired'; acceptedBy: string | null; decidedAt: string | null; createdAt: string }
export interface AccessInvite { id: string; scopeType: AccessScope; scopeId: string; scopeName: string; roleId: string; roleName: string; recipientEmail: string | null; authorId: string; authorName: string; status: 'pending' | 'accepted' | 'rejected' | 'canceled' | 'expired'; expiresAt: string | null; acceptanceLimit: number | null; acceptanceCount: number; notifiedAt: string | null; createdAt: string }
export const can = (access: { permissions?: Permissions } | null | undefined, kind: keyof Permissions, action: string) => Boolean(access?.permissions?.read.includes('view') && access.permissions[kind].includes(action))
export const canDelegate = (access: Partial<ScopeAccess> | undefined, permissions: Permissions) => Boolean(access?.permissions && (['read','write'] as const).every(kind=>permissions[kind].every(action=>access.permissions![kind].includes(action))))
export const rolePermission = { organization: 'create_org_roles', workspace: 'create_wk_roles', page: 'create_page_roles' } as const
const base = (scope: AccessScope, id: string) => `/access/${scope}/${id}`
export const accessService = {
  current: (scope: AccessScope, id: string) => apiService.get<ScopeAccess>(base(scope,id)),
  catalog: () => apiService.get<Record<AccessScope, Permissions>>('/access/catalog'),
  roles: (scope: AccessScope,id: string) => apiService.get<AccessRole[]>(base(scope,id)+'/roles'),
  saveRole: (scope: AccessScope,id: string,input: {name: string;roles: Permissions;id?: string;expectedUpdatedAt?: string}) => input.id
    ? apiService.put<AccessRole>(base(scope,id)+'/roles/'+input.id,input) : apiService.post<AccessRole>(base(scope,id)+'/roles',input),
  members: (scope: AccessScope,id: string) => apiService.get<AccessMember[]>(base(scope,id)+'/members'),
  member: (scope: AccessScope,id: string,userId: string) => apiService.get<AccessMember>(base(scope,id)+'/member/'+userId),
  assign: (scope: AccessScope,id: string,userId: string,roleId: string) => apiService.put(base(scope,id)+'/member/'+userId,{roleId}),
  add: (scope: AccessScope,id: string,email: string,roleId: string) => apiService.post(base(scope,id)+'/members',{email,roleId}),
  searchEmail: (scope: AccessScope,id:string,email:string) => apiService.get<{found:boolean;user:{id:string;name:string|null;email:string;verified:boolean}|null;isMember:boolean}>(base(scope,id)+'/member-search?email='+encodeURIComponent(email.trim().toLowerCase())),
  invites: (scope: AccessScope,id:string) => apiService.get<AccessInvite[]>(base(scope,id)+'/invites'),
  createInvite: (scope:AccessScope,id:string,input:{recipientEmail?:string|null;roleId?:string;expiresIn:'24h'|'7d'|'never';acceptanceLimit:number|null}) => apiService.post<{invite:AccessInvite;inviteUrl:string|null;notificationPending:boolean}>(base(scope,id)+'/invites',input),
  removeInvite: (scope:AccessScope,id:string,inviteId:string) => apiService.delete(base(scope,id)+'/invites/'+inviteId),
  requests: (scope: AccessScope,id: string) => apiService.get<MembershipRequest[]>(base(scope,id)+'/requests'),
  request: (scope: AccessScope,id: string) => apiService.post<{notificationPending: boolean}>(base(scope,id)+'/requests'),
  decide: (scope: AccessScope,id: string,requestId: string,decision: string,roleId?: string) => apiService.post(base(scope,id)+'/requests/'+requestId+'/decision',{decision,roleId}),
  removeRole: (scope: AccessScope,id: string,roleId: string) => apiService.delete(base(scope,id)+'/roles/'+roleId),
  organizationWorkspaceRoles: (workspaceId:string) => apiService.get<AccessRole[]>(base('workspace',workspaceId)+'/organization-workspace-roles'),
  copyWorkspaceRole: (workspaceId:string,roleId:string) => apiService.post<AccessRole>(base('workspace',workspaceId)+'/roles/'+roleId+'/copy'),
}
