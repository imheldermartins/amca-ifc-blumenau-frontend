import { Ability, AbilityBuilder } from '@casl/ability'
import { can as granted, type ScopeAccess } from '@/services/AccessService'
export type WorkspaceRole = string | null
export type WorkspaceAction = 'read' | 'manage'
export type WorkspaceSubject = 'Workspace' | 'WorkspaceRoot' | 'WorkspaceSettings' | 'WorkspaceMembers'
export type WorkspaceAbility = Ability<[WorkspaceAction, WorkspaceSubject]>
export function defineWorkspaceAbility(access: Partial<ScopeAccess> | WorkspaceRole): WorkspaceAbility {
  const {can,build}=new AbilityBuilder<WorkspaceAbility>(Ability)
  const scope=typeof access==='object'?access:null
  if(granted(scope,'read','view')){can('read','Workspace');can('read','WorkspaceRoot')}
  if(granted(scope,'write','update'))can('manage','WorkspaceSettings')
  if(granted(scope,'read','members')||granted(scope,'write','promote_members')||granted(scope,'write','add_members'))can('manage','WorkspaceMembers')
  return build()
}
