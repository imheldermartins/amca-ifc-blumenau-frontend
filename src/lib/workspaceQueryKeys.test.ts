import { describe, expect, it } from 'vitest'

import { workspaceMembersQueryKey, workspaceQueryKey } from './workspaceQueryKeys'

describe('workspace query keys', () => {
  it('isola configurações e membros por usuário autenticado', () => {
    expect(workspaceQueryKey('user-a', 'workspace'))
      .not.toEqual(workspaceQueryKey('user-b', 'workspace'))
    expect(workspaceMembersQueryKey('user-a', 'workspace'))
      .not.toEqual(workspaceMembersQueryKey('user-b', 'workspace'))
  })
})
