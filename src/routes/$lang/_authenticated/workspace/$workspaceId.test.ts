import { beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({
  getEntryPage: vi.fn(),
  setWorkspace: vi.fn(),
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: {
    getEntryPage: dependencies.getEntryPage,
  },
}))

vi.mock('@/lib/currentWorkspaceSession', () => ({
  currentWorkspaceSession: {
    set: dependencies.setWorkspace,
  },
}))

import { Route } from './$workspaceId'

type Loader = (input: {
  context: { user: { id: string } }
  params: { lang: string; workspaceId: string }
}) => Promise<unknown> | unknown

const loader = (Route as unknown as { options: { loader: Loader } }).options.loader

beforeEach(() => {
  vi.clearAllMocks()
  dependencies.getEntryPage.mockResolvedValue({ id: 'root-b', title: 'Página inicial' })
})

describe('rota de entrada da workspace', () => {
  it('resolve a pageRootId e redireciona para a rota canônica da página', async () => {
    const result = await Promise.resolve(
      loader({
        context: { user: { id: 'user-1' } },
        params: { lang: 'pt-br', workspaceId: 'workspace-b' },
      }),
    ).catch((error: unknown) => error)

    expect(dependencies.getEntryPage).toHaveBeenCalledWith('workspace-b')
    expect(dependencies.setWorkspace).toHaveBeenCalledWith('user-1', 'workspace-b')
    expect(result).toMatchObject({
      options: {
        to: '/$lang/page/$pageId',
        params: { lang: 'pt-br', pageId: 'root-b' },
        search: {},
        replace: true,
      },
    })
  })
})
