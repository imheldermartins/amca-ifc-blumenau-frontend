import type { RowData } from 'cubs-database'
import type { PageViewQueryGroup, PageViewQueryScope } from '@/shared/cubs-database/pageViewQueryContract'

/** Header pages can share ancestors. Merge those ancestors, never duplicate them. */
export function mergeDatabaseGroups(previous: PageViewQueryGroup[] = [], incoming: PageViewQueryGroup[] = [], append = false): PageViewQueryGroup[] {
  const old = new Map(previous.map((group) => [group.key, group]))
  const merged = incoming.map((group) => {
    const existing = old.get(group.key)
    const next = group.children ? { ...group, children: mergeDatabaseGroups(existing?.children, group.children, append) } : group
    return existing && JSON.stringify(existing) === JSON.stringify(next) ? existing : next
  })
  if (!append) return merged
  const updates = new Map(merged.map((group) => [group.key, group]))
  return [...previous.map((group) => updates.get(group.key) ?? group), ...merged.filter((group) => !old.has(group.key))]
}

/** An authoritative first header page may refresh/reorder a prefix without
 * forgetting header pages already loaded beyond it. New metadata always wins. */
export function refreshDatabaseGroups(previous: PageViewQueryGroup[] = [], incoming: PageViewQueryGroup[] = [], partial = false): PageViewQueryGroup[] {
  const old = new Map(previous.map((group) => [group.key, group]))
  const merged = incoming.map((group) => {
    const existing = old.get(group.key)
    const next = group.children ? { ...group, children: refreshDatabaseGroups(existing?.children, group.children, partial) } : group
    return existing && JSON.stringify(existing) === JSON.stringify(next) ? existing : next
  })
  return partial ? [...merged, ...previous.filter((group) => !incoming.some((next) => next.key === group.key))] : merged
}

export interface CachedDatabaseWindow {
  id: number
  key: string
  scope: PageViewQueryScope
  rows: RowData[]
  total: number
  nextCursor: string | null
  previousCursor: string | null
}
export interface WindowViewport { firstId?: string; lastId?: string; height?: number; visible?: boolean }

export function shareDatabaseRows(rows: RowData[], previous: ReadonlyMap<string, RowData>): RowData[] {
  return rows.map((row) => {
    const old = previous.get(row.id)
    return old && JSON.stringify(old.cells) === JSON.stringify(row.cells) ? old : row
  })
}

/** Evict whole batches away from current viewports; never evict a live editor/drag. */
export function trimDatabaseWindows(windows: CachedDatabaseWindow[], viewports: ReadonlyMap<string, WindowViewport>, pinned: ReadonlySet<string>, budget = 250): { windows: CachedDatabaseWindow[]; evicted: CachedDatabaseWindow[] } {
  const kept = [...windows]
  const evicted: CachedDatabaseWindow[] = []
  let size = kept.reduce((count, window) => count + window.rows.length, 0)
  while (size > budget) {
    let candidate = -1
    let best = -Infinity
    for (let index = 0; index < kept.length; index++) {
      const window = kept[index]
      const reported = viewports.get(window.key)
      const viewport = reported?.visible === false ? undefined : reported
      if (window.rows.some((row) => pinned.has(row.id) || row.id === viewport?.firstId || row.id === viewport?.lastId)) continue
      const sameScope = kept.filter((other) => other.key === window.key)
      // Only discard ends: holes would silently hide data between retained batches.
      if (sameScope[0] !== window && sameScope.at(-1) !== window) continue
      const score = (viewport ? 0 : 1_000_000) + (windows.length - index)
      if (score > best) { best = score; candidate = index }
    }
    if (candidate < 0) break // Visible/pinned windows may temporarily exceed the budget.
    const [window] = kept.splice(candidate, 1)
    size -= window.rows.length
    evicted.push(window)
  }
  return { windows: kept, evicted }
}

export function mergeDatabaseWindow(windows: CachedDatabaseWindow[], incoming: CachedDatabaseWindow, direction: 'next' | 'previous', replaceId?: number): CachedDatabaseWindow[] {
  if (replaceId !== undefined) return windows.map((window) => window.id === replaceId ? incoming : window)
  const ids = new Set(incoming.rows.map((row) => row.id))
  const cleaned = windows.map((window) => window.key !== incoming.key || !window.rows.some((row) => ids.has(row.id)) ? window : { ...window, rows: window.rows.filter((row) => !ids.has(row.id)) })
  const indices = cleaned.flatMap((window, index) => window.key === incoming.key ? [index] : [])
  const insertion = direction === 'previous' ? indices[0] ?? cleaned.length : (indices.at(-1) ?? cleaned.length - 1) + 1
  cleaned.splice(insertion, 0, incoming)
  return cleaned
}
