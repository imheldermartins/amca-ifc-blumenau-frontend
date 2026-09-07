import { useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button, Drawer, Select, Tooltip } from 'cubs-components'

import type { DataViewKind, HeaderCol, RowData } from '../types'
import { DATA_VIEW_KINDS, VIEW_KIND_ICON } from '../viewKinds'
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
  newPage: string
  viewType: string
  viewTypes: Record<DataViewKind, string>
  presets: string
  closePresets: string
  presetsHello: string
  groupBy: string
  filters: string
  searchColumns: string
  noColumns: string
  dragGroup: string
  selectGroup: string
  priority: string
  clearGroups?: string
  where: string
  column: string
  condition: string
  value: string
  valueFrom: string
  valueTo: string
  addFilter: string
  removeFilter: string
  clearFilters?: string
  true: string
  false: string
  conditions: Record<FilterCondition, string>
}

export interface DatabaseViewToolbarProps {
  columns: HeaderCol[]
  rows: RowData[]
  viewKind: DataViewKind
  /** Documento canônico em memória; a conversão para keys públicas é da URL. */
  filters: ViewFiltersV2
  labels: DatabaseViewToolbarLabels
  onViewKindChange?: (view: DataViewKind) => void
  onChange?: (filters: ViewFiltersV2) => void
  /** Estado de persistência/realtime já localizado pelo app host. */
  syncStatus?: DatabaseViewToolbarSyncStatus
  /** Cria uma página-filha vazia na database atual. */
  onAddRow?: () => void
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
  viewKind,
  filters,
  labels,
  onViewKindChange,
  onChange,
  syncStatus,
  onAddRow,
}: DatabaseViewToolbarProps) {
  const [presetsOpen, setPresetsOpen] = useState(false)
  // O tipo público já é v2. A leitura tolerante mantém o pacote seguro para
  // consumidores JS e garante arrays novos antes de qualquer edição local.
  const document = useMemo(() => parseViewFilters(filters), [filters])
  const columnTypes = useMemo(() => resolveColumnTypes(columns, rows), [columns, rows])
  const columnsById = useMemo(
    () => new Map(columns.map((column) => [column.id, column])),
    [columns],
  )
  const validGroupBy = document.groupBy.filter((id) => columnsById.has(id))
  const viewOptions = useMemo(
    () =>
      DATA_VIEW_KINDS.map((view) => ({
        value: view,
        label: labels.viewTypes[view],
        icon: VIEW_KIND_ICON[view],
      })),
    [labels.viewTypes],
  )

  const changeGroups = (groupBy: string[]) =>
    onChange?.(updateDocument(document, { groupBy }))
  const addFilter = (clause: ViewFilterClause) =>
    onChange?.(updateDocument(document, { clauses: [...document.clauses, clause] }))
  const clearFilters = () => onChange?.(updateDocument(document, { clauses: [] }))
  const removeFilter = (index: number) =>
    onChange?.(
      updateDocument(document, {
        clauses: document.clauses.filter((_filter, filterIndex) => filterIndex !== index),
      }),
    )

  return [
    <div key="toolbar" className="flex flex-wrap items-center gap-2 px-4 py-1">
      <Tooltip content={labels.presets} delayDuration={0}>
        <Button
          type="button"
          variant="text"
          color="from-theme"
          aria-label={labels.presets}
          className="size-8 shrink-0 p-0"
          onClick={() => setPresetsOpen(true)}
        >
          <Icon aria-hidden="true" icon="lucide:settings-2" fontSize={20} />
        </Button>
      </Tooltip>
      <Select
        aria-label={labels.viewType}
        value={viewKind}
        options={viewOptions}
        disabled={!onViewKindChange}
        onValueChange={(value) => onViewKindChange?.(value as DataViewKind)}
      />
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
          clear: labels.clearGroups,
        }}
      />
      <FilterPopover
        columns={columns}
        columnTypes={columnTypes}
        filterCount={document.clauses.length}
        disabled={!onChange}
        onAdd={addFilter}
        onClear={onChange ? clearFilters : undefined}
        labels={{
          trigger: labels.filters,
          where: labels.where,
          column: labels.column,
          condition: labels.condition,
          value: labels.value,
          valueFrom: labels.valueFrom,
          valueTo: labels.valueTo,
          add: labels.addFilter,
          clear: labels.clearFilters,
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

      {onAddRow || syncStatus ? (
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {onAddRow ? (
            <Tooltip content={labels.newPage} delayDuration={0}>
              <Button
                type="button"
                variant="filled"
                color="purple"
                aria-label={labels.newPage}
                data-create-row
                className="size-7 shrink-0 rounded-full p-0"
                onClick={onAddRow}
              >
                <Icon aria-hidden="true" icon="lucide:plus" fontSize={16} />
              </Button>
            </Tooltip>
          ) : null}
          {syncStatus ? <DatabaseViewSyncStatus status={syncStatus} /> : null}
        </div>
      ) : null}
    </div>,

    <Drawer
      key="presets"
      open={presetsOpen}
      onOpenChange={setPresetsOpen}
      accessibleTitle={labels.presets}
      closeLabel={labels.closePresets}
    >
      <div className="grid min-h-full place-items-center">
        <strong className="rounded-2xl bg-p-purple-500/10 px-8 py-6 text-4xl font-black tracking-tight text-p-purple">
          {labels.presetsHello}
        </strong>
      </div>
    </Drawer>,
  ]
}
