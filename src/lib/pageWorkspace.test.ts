import { describe, expect, it } from 'vitest'

import { findPageWorkspace, type PageBreadcrumb } from '@/lib/pageWorkspace'
import type { ApiWorkspace } from '@/services/WorkspaceService'

const workspace = (id: string, pageRootId: string): ApiWorkspace => ({
  id,
  pageRootId,
  name: id,
  data: {},
  organizationId: null,
  organizationName: null,
  isPersonal: true,
  icon: 'lucide:box',
  createdByUserId: 'user-1',
  owner: { id: 'user-1', name: 'Pessoa', email: 'pessoa@example.test' },
  role: 'member',
})

describe('findPageWorkspace', () => {
  const workspaces = [
    workspace('workspace-a', 'root-a'),
    workspace('workspace-b', 'root-b'),
  ]

  it('resolve a workspace quando a própria página é a root', () => {
    expect(findPageWorkspace(workspaces, 'root-a', [])?.id).toBe('workspace-a')
  })

  it('resolve a workspace de uma página descendente', () => {
    const breadcrumbs: PageBreadcrumb[] = [
      { id: 'child', parent_id: 'parent', depth: 0 },
      { id: 'parent', parent_id: 'root-b', depth: 1 },
    ]

    expect(findPageWorkspace(workspaces, 'child', breadcrumbs)?.id).toBe('workspace-b')
  })

  it('não atribui uma página compartilhada a uma membership inexistente', () => {
    const breadcrumbs: PageBreadcrumb[] = [
      { id: 'shared-child', parent_id: 'shared-root', depth: 0 },
    ]

    expect(findPageWorkspace(workspaces, 'shared-child', breadcrumbs)).toBeUndefined()
  })
})
