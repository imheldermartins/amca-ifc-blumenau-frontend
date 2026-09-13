import { describe, expect, it } from 'vitest'
import { defineWorkspaceAbility } from './workspaceAbility'
describe('workspaceAbility', () => {
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
