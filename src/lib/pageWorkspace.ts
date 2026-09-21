import type { ApiWorkspace } from '@/services/WorkspaceService'

export interface PageBreadcrumb {
  id: string
  parent_id: string
  depth: number
}

/**
 * Localiza a membership cuja page-root pertence à cadeia da página aberta.
 * O próprio `pageId` entra no conjunto porque uma root não possui aresta pai.
 */
export function findPageWorkspace(
  workspaces: readonly ApiWorkspace[],
  pageId: string,
  breadcrumbs: readonly PageBreadcrumb[],
): ApiWorkspace | undefined {
  const branch = new Set<string>([pageId])
  for (const crumb of breadcrumbs) {
    branch.add(crumb.id)
    branch.add(crumb.parent_id)
  }
  return workspaces.find((workspace) => branch.has(workspace.pageRootId))
}
