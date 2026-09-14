import type { HistoryState } from '@tanstack/history'

import { readPageNavigationWorkspaceId } from '@/lib/pageNavigation'

const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i

function validWorkspaceId(value: unknown): string | null {
  return typeof value === 'string' && ULID_RE.test(value) ? value : null
}

export function resolveWorkspaceRouteId(input: {
  params: Record<string, unknown>
  search: Record<string, unknown>
  state: HistoryState
  pathname: string
}): string | null {
  const scope = input.params.scope
  if (scope === 'organization' || /\/organizations(?:\/|$)/.test(input.pathname)) return null
  if (scope === 'workspace') return validWorkspaceId(input.params.scopeId)

  const routeId = validWorkspaceId(input.params.workspaceId)
  if (routeId) return routeId

  const searchId = validWorkspaceId(input.search.workspace)
  if (searchId) return searchId

  const pageId = input.pathname.match(/\/page\/([^/]+)/)?.[1]
  return validWorkspaceId(readPageNavigationWorkspaceId(input.state, pageId))
}
