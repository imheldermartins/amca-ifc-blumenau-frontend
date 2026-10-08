import type { CellChange, DatabaseRowMove, RowData } from 'cubs-database'
import type { CachedDatabaseWindow } from '@/lib/databaseWindowCache'

export function patchRowCells(row: RowData, changes: readonly CellChange[]): RowData {
  let cells = row.cells
  for (const change of changes) {
    if (change.rowId !== row.id || JSON.stringify(cells[change.columnId]?.value) === JSON.stringify(change.value ?? undefined)) continue
    if (cells === row.cells) cells = { ...cells }
    if (change.value == null) delete cells[change.columnId]
    else cells[change.columnId] = { value: change.value }
  }
  return cells === row.cells ? row : { ...row, cells }
}

/** Membership belongs to React state too: changing status moves the loaded card. */
export function patchDatabaseWindows(
  windows: CachedDatabaseWindow[], changes: readonly CellChange[], selectColumnId: string | undefined,
  nextId: () => number, move?: DatabaseRowMove,
): CachedDatabaseWindow[] {
  let next = windows.map((window) => {
    const rows = window.rows.map((row) => patchRowCells(row, changes))
    return rows.some((row, index) => row !== window.rows[index]) ? { ...window, rows } : window
  })
  if (selectColumnId) {
    for (const change of changes.filter((entry) => entry.columnId === selectColumnId)) {
      const source = next.find((window) => window.scope.type === 'board' && window.rows.some((row) => row.id === change.rowId))
      if (!source || source.scope.type !== 'board') continue
      const optionId = typeof change.value === 'string' ? change.value : '__unassigned__'
      if (source.scope.optionId === optionId) continue
      const row = source.rows.find((entry) => entry.id === change.rowId)!
      const key = `board:${optionId}`
      let destination = next.find((window) => window.key === key)
      if (!destination) {
        destination = { id: nextId(), key, scope: { type: 'board', optionId }, rows: [], total: 0, nextCursor: null, previousCursor: null }
        next = [...next, destination]
      }
      next = next.map((window) => {
        if (window.key === source.key) return { ...window, rows: window.rows.filter((entry) => entry.id !== row.id), total: Math.max(0, window.total - 1) }
        if (window.key === key) return { ...window, rows: window === destination ? [...window.rows.filter((entry) => entry.id !== row.id), row] : window.rows, total: window.total + 1 }
        return window
      })
    }
  }
  if (move) {
    const source = next.find((window) => window.rows.some((row) => row.id === move.rowId))
    const row = source?.rows.find((entry) => entry.id === move.rowId)
    if (source && row) {
      const candidates = next.filter((window) => window.key === source.key)
      const destination = candidates.find((window) => window.rows.some((entry) => entry.id === (move.beforeId ?? move.afterId)))
        ?? (move.boundary === 'start' ? candidates[0] : candidates.at(-1))!
      next = next.map((window) => {
        if (window.key !== source.key) return window
        const rows = window.rows.filter((entry) => entry.id !== row.id)
        if (window === destination) {
          const before = rows.findIndex((entry) => entry.id === move.beforeId), after = rows.findIndex((entry) => entry.id === move.afterId)
          rows.splice(before >= 0 ? before : after >= 0 ? after + 1 : move.boundary === 'start' ? 0 : rows.length, 0, row)
        }
        return { ...window, rows }
      })
    }
  }
  return next
}
