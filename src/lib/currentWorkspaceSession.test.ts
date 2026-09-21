import { beforeEach, describe, expect, it, vi } from 'vitest'

import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { workspacePreference } from '@/lib/workspacePreference'

describe('currentWorkspaceSession', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('usa a preferência persistida somente como fallback da aba', () => {
    workspacePreference.set('user-1', 'workspace-default')

    expect(currentWorkspaceSession.resolve('user-1')).toBe('workspace-default')

    currentWorkspaceSession.set('user-1', 'workspace-current')
    expect(currentWorkspaceSession.resolve('user-1')).toBe('workspace-current')
    expect(workspacePreference.get('user-1')).toBe('workspace-default')
  })

  it('não reaproveita a workspace atual entre contas', () => {
    workspacePreference.set('user-2', 'workspace-user-2')
    currentWorkspaceSession.set('user-1', 'workspace-user-1')

    expect(currentWorkspaceSession.get('user-2')).toBeUndefined()
    expect(currentWorkspaceSession.resolve('user-2')).toBe('workspace-user-2')
  })

  it('avisa o provider quando a workspace da aba muda', () => {
    const listener = vi.fn()
    const unsubscribe = currentWorkspaceSession.subscribe(listener)

    currentWorkspaceSession.set('user-1', 'workspace-current')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    currentWorkspaceSession.clear('user-1')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
