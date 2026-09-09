import { Ability, AbilityBuilder } from '@casl/ability'

export type WorkspaceRole = 'superadmin' | 'member'
export type WorkspaceAction = 'read' | 'manage'
export type WorkspaceSubject =
  | 'Workspace'
  | 'WorkspaceRoot'
  | 'WorkspaceSettings'
  | 'WorkspaceMembers'
export type WorkspaceAbility = Ability<[WorkspaceAction, WorkspaceSubject]>

/** Espelho comportamental da matriz da API; a API continua autoritativa. */
export function defineWorkspaceAbility(role: WorkspaceRole | null): WorkspaceAbility {
  const { can, build } = new AbilityBuilder<WorkspaceAbility>(Ability)

  if (role === 'superadmin' || role === 'member') {
    can('read', 'Workspace')
    can('read', 'WorkspaceRoot')
  }
  if (role === 'superadmin') {
    can('manage', 'WorkspaceSettings')
    can('manage', 'WorkspaceMembers')
  }

  return build()
}
