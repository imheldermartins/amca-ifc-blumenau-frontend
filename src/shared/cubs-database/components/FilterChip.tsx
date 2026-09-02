import { Chip, Tooltip, cn } from 'cubs-components'

import type { ColumnDataType, HeaderCol } from '../types'
import type { FilterCondition, ViewFilterClause } from '../viewFilters'

export interface FilterChipLabels {
  conditions: Record<FilterCondition, string>
  true: string
  false: string
  remove: string
}

function displayValues(
  clause: ViewFilterClause,
  column: HeaderCol,
  columnType: ColumnDataType,
  labels: FilterChipLabels,
): string {
  if (columnType === 'select') {
    const optionsById = new Map((column.options ?? []).map((option) => [option.id, option.label]))
    return clause.values.map((value) => optionsById.get(value) ?? value).join(', ')
  }
  if (columnType === 'checkbox') {
    return clause.values.map((value) => (value === 'true' ? labels.true : labels.false)).join(', ')
  }
  return clause.values.join(clause.condition === 'between' ? ' – ' : ', ')
}

export interface FilterChipProps {
  clause: ViewFilterClause
  column: HeaderCol
  columnType: ColumnDataType
  labels: FilterChipLabels
  onRemove?: () => void
}

/** Chip de domínio: traduz IDs/options, mas delega a primitiva visual ao Chip. */
export function FilterChip({
  clause,
  column,
  columnType,
  labels,
  onRemove,
}: FilterChipProps) {
  const values = displayValues(clause, column, columnType, labels)
  const description = `${column.title} · ${labels.conditions[clause.condition]} · ${values}`

  return (
    <Tooltip content={description}>
      <Chip
        onRemove={onRemove}
        removeLabel={`${labels.remove}: ${column.title}`}
        className={cn(
          'max-w-80 border-p-purple-500/60 bg-p-purple-500/10 text-p-purple',
          column.title.length > 24 && 'text-xs',
        )}
      >
        <strong className="min-w-0 truncate whitespace-nowrap">@{column.title}</strong>
        <span className="shrink-0 opacity-75">{labels.conditions[clause.condition]}</span>
        <span className="min-w-0 truncate whitespace-nowrap">{values}</span>
      </Chip>
    </Tooltip>
  )
}
