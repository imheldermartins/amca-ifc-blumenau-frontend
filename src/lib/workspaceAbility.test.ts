import { describe, expect, it } from 'vitest'
import { defineWorkspaceAbility } from './workspaceAbility'
describe('workspaceAbility', () => {
  it('separa a gestão de permissões das configurações e dos usuários', () => {
    const roleManager = defineWorkspaceAbility({ permissions: { read: ['view'], write: ['create_wk_roles'] } })
    expect(roleManager.can('manage', 'WorkspacePermissions')).toBe(true)
    expect(roleManager.can('manage', 'WorkspaceSettings')).toBe(false)
    expect(roleManager.can('manage', 'WorkspaceMembers')).toBe(false)
    expect(defineWorkspaceAbility({ permissions: { read: ['view', 'roles'], write: [] } }).can('manage', 'WorkspacePermissions')).toBe(true)
    expect(defineWorkspaceAbility({ permissions: { read: [], write: ['create_wk_roles'] } }).can('manage', 'WorkspacePermissions')).toBe(false)
  })
  it('concede cada ação pelas permissões, sem interpretar nomes de roles', () => {
    const editor = defineWorkspaceAbility({permissions: {read: ['view'], write: ['update']}})
    expect(editor.can('manage', 'WorkspaceSettings')).toBe(true)
    expect(editor.can('manage', 'WorkspaceMembers')).toBe(false)
    const recruiter = defineWorkspaceAbility({permissions: {read: ['view'], write: ['add_members']}})
    expect(recruiter.can('manage', 'WorkspaceMembers')).toBe(true)
    expect(recruiter.can('manage', 'WorkspaceSettings')).toBe(false)
    expect(defineWorkspaceAbility('superadmin').can('manage', 'WorkspaceSettings')).toBe(false)
    expect(defineWorkspaceAbility(null).can('read', 'Workspace')).toBe(false)
    expect(defineWorkspaceAbility({permissions: {read: [], write: ['update']}}).can('manage', 'WorkspaceSettings')).toBe(false)
  })
})
