import { beforeEach, describe, expect, it } from 'vitest'

import { workspacePreference } from './workspacePreference'

beforeEach(() => localStorage.clear())

describe('workspacePreference', () => {
  it('é escopada pela conta do navegador', () => {
    workspacePreference.set('user-a', 'workspace-a')
    expect(workspacePreference.get('user-a')).toBe('workspace-a')
    expect(workspacePreference.get('user-b')).toBeUndefined()
  })

  it('resolve somente workspaces ainda acessíveis e limpa preferência obsoleta', () => {
    workspacePreference.set('user-a', 'workspace-a')
    expect(workspacePreference.resolve('user-a', [{ id: 'workspace-a' }]))
      .toEqual({ id: 'workspace-a' })
    expect(workspacePreference.resolve('user-a', [{ id: 'workspace-b' }])).toBeUndefined()
    expect(workspacePreference.get('user-a')).toBeUndefined()
  })
})
