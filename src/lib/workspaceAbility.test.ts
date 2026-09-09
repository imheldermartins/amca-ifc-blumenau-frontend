import { describe, expect, it } from 'vitest'

import { defineWorkspaceAbility } from './workspaceAbility'

describe('workspaceAbility', () => {
  it('permite o painel somente ao superadmin', () => {
    expect(defineWorkspaceAbility('superadmin').can('manage', 'WorkspaceSettings')).toBe(true)
    expect(defineWorkspaceAbility('member').can('manage', 'WorkspaceSettings')).toBe(false)
    expect(defineWorkspaceAbility(null).can('read', 'Workspace')).toBe(false)
  })
})
