import { describe, expect, it } from 'vitest'

import { resolveWorkspaceRouteId } from './workspaceRouteContext'

const WORKSPACE_ID = '01KXVZ00000000000000000001'
const PAGE_ID = '01KXVZ00000000000000000002'

describe('resolveWorkspaceRouteId', () => {
  const base = { params: {}, search: {}, state: {}, pathname: '/pt-br/workspaces' }

  it('mantém a workspace em rotas de acesso e páginas navegadas', () => {
    expect(resolveWorkspaceRouteId({ ...base, params: { scope: 'workspace', scopeId: WORKSPACE_ID } })).toBe(WORKSPACE_ID)
    expect(resolveWorkspaceRouteId({ ...base, pathname: `/pt-br/page/${PAGE_ID}`, search: { workspace: WORKSPACE_ID } })).toBe(WORKSPACE_ID)
    expect(resolveWorkspaceRouteId({
      ...base,
      pathname: `/pt-br/page/${PAGE_ID}`,
      state: { pageShell: { pageId: PAGE_ID, title: null, workspaceId: WORKSPACE_ID } },
    })).toBe(WORKSPACE_ID)
  })

  it('não herda workspace em organização nem aceita ids inválidos', () => {
    expect(resolveWorkspaceRouteId({ ...base, params: { scope: 'organization', workspaceId: WORKSPACE_ID } })).toBeNull()
    expect(resolveWorkspaceRouteId({ ...base, pathname: '/pt-br/organizations/org-1', search: { workspace: WORKSPACE_ID } })).toBeNull()
    expect(resolveWorkspaceRouteId({ ...base, search: { workspace: 'mychat/schedule' } })).toBeNull()
  })
})
