import { useMemo } from 'react'

import type { HeaderCol, RowData } from '../types'
import {
  parseViewFilters,
  VIEW_FILTERS_VERSION,
  type FilterCondition,
  type ParsedViewFilters,
  type ViewFilterClause,
  type ViewFiltersV2,
} from '../viewFilters'
import { resolveColumnTypes } from '../utils'
import {
  DatabaseViewSyncStatus,
  type DatabaseViewToolbarSyncStatus,
} from './DatabaseViewSyncStatus'
import { FilterChip } from './FilterChip'
import { FilterPopover } from './FilterPopover'
import { PrioritySelect } from './PrioritySelect'

export interface DatabaseViewToolbarLabels {
  groupBy: string
  filters: string
  searchColumns: string
  noColumns: string
  dragGroup: string
  selectGroup: string
  priority: string
  where: string
  column: string
  condition: string
  value: string
  valueFrom: string
  valueTo: string
  addFilter: string
  removeFilter: string
  true: string
  false: string
  conditions: Record<FilterCondition, string>
}

export interface DatabaseViewToolbarProps {
  columns: HeaderCol[]
  rows: RowData[]
  /** Documento canônico em memória; a conversão para keys públicas é da URL. */
  filters: ViewFiltersV2
  labels: DatabaseViewToolbarLabels
  onChange?: (filters: ViewFiltersV2) => void
  /** Estado de persistência/realtime já localizado pelo app host. */
  syncStatus?: DatabaseViewToolbarSyncStatus
}

function updateDocument(
  document: ParsedViewFilters,
  patch: Partial<Pick<ParsedViewFilters, 'clauses' | 'groupBy'>>,
): ViewFiltersV2 {
  return {
    ...document,
    version: VIEW_FILTERS_VERSION,
    ...patch,
  }
}

/** Controles da view: agrupamento por prioridade e filtros como chips. */
export function DatabaseViewToolbar({
  columns,
  rows,
  filters,
  labels,
  onChange,
  syncStatus,
}: DatabaseViewToolbarProps) {
  // O tipo público já é v2. A leitura tolerante mantém o pacote seguro para
  // consumidores JS e garante arrays novos antes de qualquer edição local.
  const document = useMemo(() => parseViewFilters(filters), [filters])
  const columnTypes = useMemo(() => resolveColumnTypes(columns, rows), [columns, rows])
  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  )
  const validGroupBy = document.groupBy.filter((id) => columnsById.has(id))

  const changeGroups = (groupBy: string[]) =>
    onChange?.(updateDocument(document, { groupBy }))
  const addFilter = (clause: ViewFilterClause) =>
    onChange?.(updateDocument(document, { clauses: [...document.clauses, clause] }))
  const removeFilter = (index: number) =>
    onChange?.(
      updateDocument(document, {
        clauses: document.clauses.filter((_filter, filterIndex) => filterIndex !== index),
      }),
    )

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-1">
      <PrioritySelect
        options={columns.map((column) => ({ value: column.id, label: column.title }))}
        value={validGroupBy}
        onValueChange={changeGroups}
        disabled={!onChange}
        icon="lucide:group"
        labels={{
          trigger: labels.groupBy,
          search: labels.searchColumns,
          empty: labels.noColumns,
          drag: labels.dragGroup,
          select: labels.selectGroup,
          priority: labels.priority,
        }}
      />
      <FilterPopover
        columns={columns}
        columnTypes={columnTypes}
        filterCount={document.clauses.length}
        disabled={!onChange}
        onAdd={addFilter}
        labels={{
          trigger: labels.filters,
          where: labels.where,
          column: labels.column,
          condition: labels.condition,
          value: labels.value,
          valueFrom: labels.valueFrom,
          valueTo: labels.valueTo,
          add: labels.addFilter,
          true: labels.true,
          false: labels.false,
          conditions: labels.conditions,
        }}
      />

      {document.clauses.map((clause, index) => {
        const column = columnsById.get(clause.columnId)
        const columnType = column ? columnTypes[column.id] : undefined
        if (!column || !columnType) return null
        return (
          <FilterChip
            key={`${clause.columnId}:${clause.condition}:${clause.values.join('\u0000')}:${index}`}
            clause={clause}
            column={column}
            columnType={columnType}
            onRemove={onChange ? () => removeFilter(index) : undefined}
            labels={{
              conditions: labels.conditions,
              true: labels.true,
              false: labels.false,
              remove: labels.removeFilter,
            }}
          />
        )
      })}

      {syncStatus ? <DatabaseViewSyncStatus status={syncStatus} /> : null}
    </div>
  )
}
