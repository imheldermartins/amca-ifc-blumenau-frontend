import { beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  currentWorkspaceSession: {
    get: vi.fn(),
    set: vi.fn(),
  },
  getBreadcrumb: vi.fn(),
  listMine: vi.fn(),
}))

vi.mock('@/lib/currentWorkspaceSession', () => ({
  currentWorkspaceSession: dependencies.currentWorkspaceSession,
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: {
    getBreadcrumb: dependencies.getBreadcrumb,
  },
}))

vi.mock('@/services/WorkspaceService', () => ({
  workspaceService: {
    listMine: dependencies.listMine,
  },
}))

import { Route } from './$pageId'

type BeforeLoad = (input: {
  context: { user: { id: string } }
  location: { search: Record<string, unknown> }
  params: { lang: string; pageId: string }
}) => Promise<unknown> | unknown

const beforeLoad = (Route as unknown as { options: { beforeLoad: BeforeLoad } }).options.beforeLoad

const workspace = (id: string, pageRootId: string) => ({
  id,
  pageRootId,
})

beforeEach(() => {
  vi.clearAllMocks()
  dependencies.currentWorkspaceSession.get.mockReturnValue('workspace-a')
  dependencies.listMine.mockResolvedValue([
    workspace('workspace-a', 'root-a'),
    workspace('workspace-b', 'root-b'),
  ])
  dependencies.getBreadcrumb.mockResolvedValue([
    { id: 'page-b', parent_id: 'root-b', depth: 0 },
  ])
})

describe('rota de página — contexto da workspace', () => {
  it('revalida a página mesmo quando a aba já tinha outra workspace', async () => {
    await beforeLoad({
      context: { user: { id: 'user-1' } },
      location: { search: {} },
      params: { lang: 'pt-br', pageId: 'page-b' },
    })

    expect(dependencies.listMine).toHaveBeenCalledTimes(1)
    expect(dependencies.getBreadcrumb).toHaveBeenCalledWith('page-b')
    expect(dependencies.currentWorkspaceSession.set).toHaveBeenCalledWith(
      'user-1',
      'workspace-b',
    )
  })
})
