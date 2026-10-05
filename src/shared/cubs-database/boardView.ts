import type { BoardViewConfig, HeaderCol, RowData } from './types'

export const BOARD_UNASSIGNED = '__unassigned__'
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i

export function parseBoardConfig(raw: unknown): BoardViewConfig | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const value = raw as Record<string, unknown>
  const list = (key: string, options = false) => Array.isArray(value[key])
    ? [...new Set((value[key] as unknown[]).filter((id): id is string =>
      typeof id === 'string' && (ULID.test(id) || (options && id === BOARD_UNASSIGNED))))]
    : undefined
  return {
    ...(typeof value.selectColumnId === 'string' && ULID.test(value.selectColumnId) && { selectColumnId: value.selectColumnId }),
    ...(list('optionOrder', true) && { optionOrder: list('optionOrder', true) }),
    ...(list('collapsedOptionIds', true) && { collapsedOptionIds: list('collapsedOptionIds', true) }),
    ...(list('propertyIds') && { propertyIds: list('propertyIds') }),
    ...(typeof value.showPropertyLabels === 'boolean' && { showPropertyLabels: value.showPropertyLabels }),
  }
}

export function boardColumn(columns: readonly HeaderCol[], config?: BoardViewConfig) {
  return config?.selectColumnId
    ? columns.find((column) => column.id === config.selectColumnId && column.type === 'select')
    : columns.find((column) => column.type === 'select')
}

export function boardKey(row: RowData, column: HeaderCol): string {
  const value = row.cells[column.id]?.value
  return column.options?.some((option) => option.id === value) ? String(value) : BOARD_UNASSIGNED
}

/** Move only the dragged id; filtered-out pages keep their relative order. */
export function boardRowOrder(allRows: readonly RowData[], rowId: string, beforeId?: string, afterId?: string): string[] {
  const ids = allRows.map((row) => row.id).filter((id) => id !== rowId)
  const before = beforeId ? ids.indexOf(beforeId) : -1
  const after = afterId ? ids.indexOf(afterId) : -1
  ids.splice(before >= 0 ? before : after >= 0 ? after + 1 : ids.length, 0, rowId)
  return ids
}

/** Preserve untouched lists, including the whole object for an unchanged slot. */
export function relocateBoardCard(groups: Record<string, string[]>, rowId: string, targetKey: string, targetRowId?: string, insertAfter = false) {
  const sourceKey = Object.keys(groups).find((key) => groups[key]?.includes(rowId))
  if (!sourceKey || !groups[targetKey] || targetRowId === rowId) return groups
  const source = groups[sourceKey]!, destination = groups[targetKey]!
  const from = source.indexOf(rowId)
  let to = targetRowId ? destination.indexOf(targetRowId) : destination.length
  if (to < 0) to = destination.length
  if (insertAfter && to < destination.length) to++
  if (sourceKey === targetKey && from < to) to--
  if (sourceKey === targetKey && from === to) return groups
  const nextSource = [...source]; nextSource.splice(from, 1)
  const nextDestination = sourceKey === targetKey ? nextSource : [...destination]
  nextDestination.splice(to, 0, rowId)
  return { ...groups, [sourceKey]: nextSource, [targetKey]: nextDestination }
}
