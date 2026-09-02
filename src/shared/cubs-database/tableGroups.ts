import type { ColumnDataType, HeaderCol, RowData } from './types'
import { formatCellValue, formatNumericValue } from './utils'

export interface TableGroupNode {
  key: string
  columnId: string
  rawValue: unknown
  rows: RowData[]
  children: TableGroupNode[]
  depth: number
}

export interface TableGroupLabels {
  empty: string
  true: string
  false: string
  rows: (count: number) => string
}

function rawValueKey(value: unknown): string {
  if (value === undefined) return 'undefined:'
  if (value === null) return 'null:'
  if (value instanceof Date) return `date:${value.toISOString()}`
  if (typeof value === 'object') {
    try {
      return `object:${JSON.stringify(value)}`
    } catch {
      return `object:${String(value)}`
    }
  }
  return `${typeof value}:${String(value)}`
}

/** Monta a árvore de grupos; o primeiro id é sempre a prioridade externa. */
export function buildTableGroups(rows: RowData[], groupBy: string[]): TableGroupNode[] {
  const buildLevel = (
    levelRows: RowData[],
    depth: number,
    parentKey: string,
  ): TableGroupNode[] => {
    const columnId = groupBy[depth]
    if (!columnId) return []

    const buckets = new Map<string, { rawValue: unknown; rows: RowData[] }>()
    for (const row of levelRows) {
      const rawValue = row.cells[columnId]?.value
      const valueKey = rawValueKey(rawValue)
      const bucket = buckets.get(valueKey)
      if (bucket) bucket.rows.push(row)
      else buckets.set(valueKey, { rawValue, rows: [row] })
    }

    return [...buckets.entries()].map(([valueKey, bucket]) => {
      const key = `${parentKey}/${columnId}/${encodeURIComponent(valueKey)}`
      return {
        key,
        columnId,
        rawValue: bucket.rawValue,
        rows: bucket.rows,
        children:
          depth + 1 < groupBy.length ? buildLevel(bucket.rows, depth + 1, key) : [],
        depth,
      }
    })
  }

  return buildLevel(rows, 0, 'groups')
}

export function formatTableGroupValue(
  value: unknown,
  column: HeaderCol,
  columnType: ColumnDataType,
  labels: TableGroupLabels,
): string {
  if (value === undefined || value === null || value === '') return labels.empty
  if (columnType === 'select') {
    return column.options?.find((option) => option.id === value)?.label ?? labels.empty
  }
  if (columnType === 'checkbox') return value === true ? labels.true : labels.false
  if (columnType === 'numeric') return formatNumericValue(value, column.format) || labels.empty
  return formatCellValue(value)
}
