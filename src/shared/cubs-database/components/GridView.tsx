import { FormulaResult } from './FormulaResult'
import { formulaText } from '../formulaValue'
import { Icon } from '@iconify/react'
import { cn, formatDatePickerValue } from 'cubs-components'
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { CellChange, CellEditConflict, HeaderCol, RowData } from '../types'
import type { ViewMockSettings } from '../viewSettings'
import { cellErrorKey, formatNumericValue } from '../utils'
import { TextCellEditor } from './cells/TextCellEditor'
import type { DatabasePagination } from '../pagination'
import { VirtualInfiniteList } from './VirtualInfiniteList'
import { RelationChips } from './cells/RelationCellEditor'

const ROOT_SCOPE = { type: 'root' } as const

function displayValue(row: RowData, column: HeaderCol): string | null {
  const value = row.cells[column.id]?.value
  if (value === null || value === undefined || value === '') return null
  if (column.type === 'formula') return formulaText(value)
  if (column.type === 'select') {
    return column.options?.find((option) => option.id === value)?.label ?? null
  }
  if (column.type === 'relation' && Array.isArray(value)) {
    return value.map((id) => typeof id === 'string' ? column.relationTargets?.[id]?.title : undefined).filter(Boolean).join(', ') || null
  }
  if (column.type === 'date') return formatDatePickerValue(value)
  if (column.type === 'extract_as' && !column.rollupResult) return 'Configuração indisponível'
  if (column.type === 'extract_as' && column.format) return formatNumericValue(value, column.format)
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

export function GridTile({
  row,
  columns,
  propertyIds,
  onOpen,
  onCellChange,
  onCellEditConflict,
  cellErrors,
  lockedColumnKeys,
}: {
  row: RowData
  columns: HeaderCol[]
  propertyIds?: string[]
  onOpen?: (row: RowData) => void
  onCellChange?: (change: CellChange) => void
  onCellEditConflict?: (conflict: CellEditConflict) => void
  cellErrors?: ReadonlySet<string>
  lockedColumnKeys?: ReadonlySet<string>
}) {
  const titleColumn = columns.find((column) => column.key === 'title' || column.id === 'page_title')
  const previousTitle = row.cells[titleColumn?.id ?? 'page_title']?.value
  const title = typeof previousTitle === 'string' ? previousTitle : ''
  const hasTitle = !!title
  const displayedTitle = hasTitle ? title : 'Sem Título'
  const titleLocked = lockedColumnKeys?.has('title') || (titleColumn && lockedColumnKeys?.has(titleColumn.id))
  const titleError = titleColumn && cellErrors?.has(cellErrorKey(row.id, titleColumn.id))
  const propertyColumns = propertyIds === undefined
    ? columns.filter((column) => column.id !== titleColumn?.id)
    : propertyIds
      .map((id) => columns.find((column) => column.id === id))
      .filter((column): column is HeaderCol => Boolean(column && column.id !== titleColumn?.id))
  const details = propertyColumns
    .map((column) => ({ column, value: displayValue(row, column) }))
    .filter((entry) => entry.value !== null)

  return (
    <article data-list-row={row.id} className="group flex min-h-40 w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-divider bg-background p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 flex min-w-0 items-start gap-2 overflow-hidden">
        <Icon icon="lucide:file-text" fontSize={18} className="mt-0.5 shrink-0" />
        <h3 className={cn('min-w-0 flex-1 break-words font-semibold', titleError && 'text-p-red')}>
          {titleColumn && onCellChange && !titleLocked ? (
            <TextCellEditor
              rowId={row.id}
              column={titleColumn}
              value={previousTitle}
              hasError={titleError}
              className="[font:inherit]"
              inputClassName="h-auto border-0 p-0 [font:inherit]"
              onCommit={(value) => onCellChange({ rowId: row.id, columnId: titleColumn.id, value, previousValue: previousTitle })}
              onExternalConflict={() => onCellEditConflict?.({
                rowId: row.id,
                columnId: titleColumn.id,
                columnTitle: titleColumn.title,
                value: previousTitle,
                displayValue: displayedTitle,
              })}
            />
          ) : displayedTitle}
        </h3>
        {onOpen && (
          <button
            type="button"
            aria-label={`Abrir ${displayedTitle}`}
            onClick={() => onOpen(row)}
            className="rounded p-1 opacity-60 hover:bg-active hover:opacity-100"
          >
            <Icon icon="lucide:arrow-up-right" fontSize={16} />
          </button>
        )}
      </div>
      <dl className="mt-auto grid min-w-0 max-w-full gap-2 overflow-hidden text-xs">
        {details.map(({ column, value }) => (
          <div key={column.id} className="flex min-w-0 max-w-full justify-between gap-3 overflow-hidden border-t border-divider pt-2">
            <dt className="min-w-0 truncate opacity-60">{column.title}</dt>
            <dd className="min-w-0 max-w-[60%] overflow-hidden truncate text-right">
              {column.type === 'formula' ? <FormulaResult value={row.cells[column.id]?.value} /> : column.type === 'relation'
                ? <RelationChips column={column} value={row.cells[column.id]?.value} />
                : value}
            </dd>
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
  propertyIds,
  emptyLabel,
  onOpenRow,
  onCellChange,
  onCellEditConflict,
  cellErrors,
  lockedColumnKeys,
  pagination,
}: {
  columns: HeaderCol[]
  rows: RowData[]
  tileSize: ViewMockSettings['tileSize']
  propertyIds?: string[]
  emptyLabel?: string
  onOpenRow?: (row: RowData) => void
  onCellChange?: (change: CellChange) => void
  onCellEditConflict?: (conflict: CellEditConflict) => void
  cellErrors?: ReadonlySet<string>
  lockedColumnKeys?: ReadonlySet<string>
  pagination?: DatabasePagination
}) {
  const container = useRef<HTMLDivElement>(null)
  const isPaginated = Boolean(pagination)
  const [width, setWidth] = useState(800)
  useLayoutEffect(() => {
    if (!isPaginated || !container.current || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [isPaginated])
  const lanes = Math.max(1, Math.floor(width / (tileSize === 'small' ? 170 : tileSize === 'large' ? 332 : 232)))
  const bands = useMemo(() => Array.from({ length: Math.ceil(rows.length / lanes) }, (_, index) => rows.slice(index * lanes, (index + 1) * lanes)), [rows, lanes])
  const bandKey = useCallback((band: RowData[]) => band[0].id, [])
  const bandIds = useCallback((band: RowData[]) => band.map((row) => row.id), [])
  const renderTile = (row: RowData) => <GridTile key={row.id} row={row} columns={columns} propertyIds={propertyIds} onOpen={onOpenRow}
    onCellChange={onCellChange} onCellEditConflict={onCellEditConflict} cellErrors={cellErrors} lockedColumnKeys={lockedColumnKeys} />
  if (pagination) return <div ref={container}>
    <VirtualInfiniteList items={bands} itemKey={bandKey} itemIds={bandIds} scope={ROOT_SCOPE} stream={pagination.streams.root} pagination={pagination} estimateSize={160} gap={12}
      renderItem={(band) => <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${lanes},minmax(0,1fr))` }}>{band.map(renderTile)}</div>} />
  </div>
  if (rows.length === 0) return <p className="px-4 py-8 text-center text-sm opacity-60">{emptyLabel}</p>
  return (
    <GridContainer tileSize={tileSize}>
      {rows.map(renderTile)}
    </GridContainer>
  )
}
