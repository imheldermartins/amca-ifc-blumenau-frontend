import { useState, type ReactNode } from 'react'
import { Icon } from '@iconify/react'
import { Tooltip, cn } from 'cubs-components'

import type { ColumnDataType, HeaderCol, RowData } from '../types'
import {
  buildTableGroups,
  formatTableGroupValue,
  type TableGroupLabels,
  type TableGroupNode,
} from '../tableGroups'

interface TableGroupBranchProps {
  node: TableGroupNode
  columnsById: Map<string, HeaderCol>
  columnTypes: Record<string, ColumnDataType>
  labels: TableGroupLabels
  renderRow: (row: RowData, depth: number) => ReactNode
}

function TableGroupBranch({
  node,
  columnsById,
  columnTypes,
  labels,
  renderRow,
}: TableGroupBranchProps) {
  const [open, setOpen] = useState(true)
  const column = columnsById.get(node.columnId)
  if (!column) return <>{node.rows.map((row) => renderRow(row, node.depth + 1))}</>
  const formattedValue = formatTableGroupValue(
    node.rawValue,
    column,
    columnTypes[column.id],
    labels,
  )
  const tooltip = `${column.title}: ${formattedValue}`

  return (
    <div role="group" data-group-key={node.key}>
      <Tooltip content={tooltip}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-9 w-full min-w-max items-center gap-2 border-y border-divider bg-contrast pr-3 py-1 text-left text-sm text-foreground transition-colors hover:bg-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-p-purple/50"
          style={{ paddingLeft: 16 + node.depth * 18 }}
        >
          <span
            className={cn(
              '-translate-x-1 inline-flex min-w-0 max-w-[min(32rem,calc(100vw-8rem))] items-center gap-1.5 whitespace-nowrap rounded-md bg-p-purple px-2 py-1 font-semibold text-white',
              column.title.length > 24 && 'text-xs',
            )}
          >
            <Icon
              icon="lucide:chevron-right"
              fontSize={15}
              className={cn(
                'shrink-0 transition-transform',
                open && 'rotate-90',
              )}
            />
            <span className="min-w-0 truncate whitespace-nowrap opacity-80">
              {column.title}:
            </span>
            <span className="min-w-0 truncate whitespace-nowrap">{formattedValue}</span>
          </span>
          <span className="ml-auto shrink-0 rounded-full border border-divider bg-background px-2 py-0.5 text-xs font-medium text-foreground">
            {labels.rows(node.rows.length)}
          </span>
        </button>
      </Tooltip>

      {open
        ? node.children.length > 0
          ? node.children.map((child) => (
              <TableGroupBranch
                key={child.key}
                node={child}
                columnsById={columnsById}
                columnTypes={columnTypes}
                labels={labels}
                renderRow={renderRow}
              />
            ))
          : node.rows.map((row) => renderRow(row, node.depth + 1))
        : null}
    </div>
  )
}

export interface TableGroupAccordionProps {
  rows: RowData[]
  groupBy: string[]
  columns: HeaderCol[]
  columnTypes: Record<string, ColumnDataType>
  labels: TableGroupLabels
  renderRow: (row: RowData, depth: number) => ReactNode
}

/** Faixas roxas recolhíveis, aninhadas pela prioridade escolhida. */
export function TableGroupAccordion({
  rows,
  groupBy,
  columns,
  columnTypes,
  labels,
  renderRow,
}: TableGroupAccordionProps) {
  const columnsById = new Map(columns.map((column) => [column.id, column]))
  const groups = buildTableGroups(rows, groupBy.filter((id) => columnsById.has(id)))

  return (
    <>
      {groups.map((node) => (
        <TableGroupBranch
          key={node.key}
          node={node}
          columnsById={columnsById}
          columnTypes={columnTypes}
          labels={labels}
          renderRow={renderRow}
        />
      ))}
    </>
  )
}
