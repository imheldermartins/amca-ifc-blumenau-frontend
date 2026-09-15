import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'
import type { ReactNode } from 'react'

import type { HeaderCol, RowData } from '../types'
import type { ViewMockSettings } from '../viewSettings'

function displayValue(row: RowData, column: HeaderCol): string | null {
  const value = row.cells[column.id]?.value
  if (value === null || value === undefined || value === '') return null
  if (column.type === 'select') {
    return column.options?.find((option) => option.id === value)?.label ?? null
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

export function GridTile({
  row,
  columns,
  onOpen,
}: {
  row: RowData
  columns: HeaderCol[]
  onOpen?: (row: RowData) => void
}) {
  const titleColumn = columns.find((column) => column.key === 'title') ?? columns[0]
  const title = titleColumn ? displayValue(row, titleColumn) : null
  const details = columns.filter((column) => column.id !== titleColumn?.id)
    .map((column) => ({ column, value: displayValue(row, column) }))
    .filter((entry) => entry.value !== null)
    .slice(0, 4)

  return (
    <article className="group flex min-h-40 flex-col rounded-xl border border-divider bg-background p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex items-start gap-2">
        <Icon icon="lucide:file-text" fontSize={18} className="mt-0.5 shrink-0 text-p-purple" />
        <h3 className="min-w-0 flex-1 break-words font-semibold">{title ?? 'Sem Título'}</h3>
        {onOpen && (
          <button
            type="button"
            aria-label={`Abrir ${title ?? 'Sem Título'}`}
            onClick={() => onOpen(row)}
            className="rounded p-1 opacity-60 hover:bg-active hover:opacity-100"
          >
            <Icon icon="lucide:arrow-up-right" fontSize={16} />
          </button>
        )}
      </div>
      <dl className="mt-auto grid gap-2 text-xs">
        {details.map(({ column, value }) => (
          <div key={column.id} className="flex justify-between gap-3 border-t border-divider pt-2">
            <dt className="truncate opacity-60">{column.title}</dt>
            <dd className="max-w-[60%] truncate text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  )
}

export function GridContainer({
  children,
  tileSize,
}: {
  children: ReactNode
  tileSize: ViewMockSettings['tileSize']
}) {
  return (
    <div
      data-grid-container
      className={cn(
        'grid gap-3 px-4',
        tileSize === 'small' && 'grid-cols-[repeat(auto-fill,minmax(180px,1fr))]',
        tileSize === 'medium' && 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]',
        tileSize === 'large' && 'grid-cols-[repeat(auto-fill,minmax(320px,1fr))]',
      )}
    >
      {children}
    </div>
  )
}

export function GridView({
  columns,
  rows,
  tileSize,
  emptyLabel,
  onOpenRow,
}: {
  columns: HeaderCol[]
  rows: RowData[]
  tileSize: ViewMockSettings['tileSize']
  emptyLabel?: string
  onOpenRow?: (row: RowData) => void
}) {
  if (rows.length === 0) return <p className="px-4 py-8 text-center text-sm opacity-60">{emptyLabel}</p>
  return (
    <GridContainer tileSize={tileSize}>
      {rows.map((row) => <GridTile key={row.id} row={row} columns={columns} onOpen={onOpenRow} />)}
    </GridContainer>
  )
}
