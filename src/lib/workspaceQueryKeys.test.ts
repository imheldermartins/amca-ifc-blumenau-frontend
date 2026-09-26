import { describe, expect, it } from 'vitest'

import { workspaceMembersQueryKey, workspaceQueryKey, workspacesQueryKey } from './workspaceQueryKeys'

describe('workspace query keys', () => {
  it('isola a lista de workspaces por usuário', () => {
    expect(workspacesQueryKey('user-a')).not.toEqual(workspacesQueryKey('user-b'))
  })

  it('isola configurações e membros por usuário autenticado', () => {
    expect(workspaceQueryKey('user-a', 'workspace'))
      .not.toEqual(workspaceQueryKey('user-b', 'workspace'))
    expect(workspaceMembersQueryKey('user-a', 'workspace'))
      .not.toEqual(workspaceMembersQueryKey('user-b', 'workspace'))
  })
})
