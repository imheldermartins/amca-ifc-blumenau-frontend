import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { Checkbox, cn, type CheckedState } from 'cubs-components'

import type { CellChange, ColumnDataType, ColumnOption, HeaderCol, RowData } from '../types'
import { resolveColumnTypes, resolveColumnWidth } from '../utils'
import { ColumnHeaderMenu } from './ColumnHeaderMenu'
import { CONTROL_CELL_WIDTH, TableRow } from './TableRow'
import type { TableRowLabels } from './TableRow'
import { TYPE_ICON } from './columnTypeIcons'
import { useSortableSensors } from './dndSensors'
import { useShiftKey } from './useShiftKey'

export interface TableViewProps {
  columns: HeaderCol[]
  rows: RowData[]
  /**
   * `columnWidths` da view: largura em px por ID de coluna. Uma única fonte
   * para header e células — sem isso as duas grades divergem.
   */
  columnWidths?: Record<string, number>
  loading?: boolean
  emptyLabel?: string
  /** Clique no botão "Abrir ›" de uma linha — recebe a row crua. */
  onOpenRow?: (row: RowData) => void
  /** Presente = células editáveis (ver o cellMap em `components/cells`). */
  onCellChange?: (change: CellChange) => void
  /** Reordenação das options de uma coluna select (array completo). */
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  /** Drag de LINHA solto → ids na nova ordem (array completo da view). */
  onRowOrderChange?: (orderedRows: string[]) => void
  /** Drag de COLUNA solto → ids na nova ordem (incl. a coluna sintética). */
  onColumnOrderChange?: (orderedHeaderCols: string[]) => void
  /** Seleção mudou → `selectedPagesIds` completo (futuro batch do realtime). */
  onSelectionChange?: (selectedPagesIds: string[]) => void
  /** Renomear coluna pelo menu do header (payload do `column-renamed`). */
  onColumnRename?: (columnId: string, name: string) => void
  /** Resize solto → mapa COMPLETO de larguras (px por id de coluna). */
  onColumnWidthChange?: (columnWidths: Record<string, number>) => void
  labels?: TableRowLabels
}

/**
 * Header cell sortable: o handle fica CENTRALIZADO NO TOPO e só aparece no
 * hover — o header continua limpo, e o drag nunca disputa com o clique (o
 * activator é só o handle). Botão direito abre o menu da coluna.
 */
function SortableHeaderCell({
  column,
  columnType,
  width,
  sortable,
  resizable,
  isLast,
  dragLabel,
  resizeLabel,
  onResize,
  onResizeEnd,
  onContextMenu,
}: {
  column: HeaderCol
  columnType: ColumnDataType
  width?: number
  sortable: boolean
  resizable: boolean
  /** Última coluna: fecha a grade com a borda direita. */
  isLast: boolean
  dragLabel: string
  resizeLabel: string
  /** Largura durante o arrasto (otimista, a cada movimento). */
  onResize: (width: number) => void
  /** Soltou: hora de persistir. */
  onResizeEnd: () => void
  onContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, disabled: !sortable })

  // O resize NÃO é dnd-kit: não há reordenação nem drop target, é só arrastar
  // uma borda. Pointer capture direto é mais simples e não briga com o sensor
  // do sortable (que ignora o que acontece fora do seu activator).
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null)

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStartRef.current = { x: event.clientX, width: resolveColumnWidth(width) }
  }

  const handleResizePointerMove = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const start = resizeStartRef.current
    if (!start) return
    onResize(start.width + (event.clientX - start.x))
  }

  const handleResizePointerUp = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (!resizeStartRef.current) return
    resizeStartRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
    onResizeEnd()
  }

  return (
    <div
      role="columnheader"
      ref={setNodeRef}
      style={{
        width: resolveColumnWidth(width),
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      onContextMenu={onContextMenu}
      className={cn(
        'group/col relative flex shrink-0 items-center gap-1.5 border-l border-divider px-3 py-2 text-sm font-medium opacity-60',
        // A ÚLTIMA coluna fecha a grade à direita: sem esta borda a tabela
        // termina "aberta" e a alça de resize da última coluna não teria em
        // que se apoiar visualmente. Por PROP, e não por `last:`, porque o
        // DndContext injeta uma live-region de a11y como último irmão — o
        // seletor `:last-child` pegaria ela, não a coluna.
        isLast && 'border-r',
        isDragging && 'z-10 opacity-90',
      )}
    >
      {sortable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={dragLabel}
          {...attributes}
          {...listeners}
          className={cn(
            'absolute left-1/2 top-0 -translate-x-1/2 cursor-grab rounded px-1 leading-none',
            'opacity-0 transition-opacity hover:bg-active group-hover/col:opacity-100 focus-visible:opacity-100',
          )}
        >
          <Icon icon="lucide:grip-horizontal" fontSize={12} />
        </button>
      )}
      <Icon icon={TYPE_ICON[columnType]} fontSize={14} className="shrink-0" />
      <span className="truncate">{column.title}</span>
      {resizable && (
        // Alça sobre a borda DIREITA (a mesma que separa da próxima coluna).
        // `touch-none` porque o pointer capture precisa dos eventos que o
        // scroll horizontal roubaria no touch.
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={resizeLabel}
          onPointerDown={handleResizePointerDown}
          onPointerMove={handleResizePointerMove}
          onPointerUp={handleResizePointerUp}
          className={cn(
            'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none',
            'opacity-0 transition-opacity hover:bg-p-purple group-hover/col:opacity-100',
          )}
        />
      )}
    </div>
  )
}

/**
 * View 'table': linhas contíguas em zebra striping (background × contrast)
 * com separadores verticais entre as colunas. A célula de controles ocupa a
 * posição zero (mesma largura no header, para o alinhamento bater).
 *
 * As colunas têm largura FIXA (px), definida na view via `columnWidths` — não
 * na coluna. Header e células resolvem a largura pelo mesmo mapa, então a
 * grade bate mesmo numa linha que não tenha valor para todas as colunas.
 *
 * O TIPO segue a mesma ideia: resolvido uma vez aqui (declarado na coluna ou
 * inferido dos valores) e distribuído — o ícone do header e o render da
 * célula leem do mesmo mapa, nunca decidem cada um por si.
 *
 * REORDENAÇÃO (linhas e colunas) é OTIMISTA: a ordem local muda no drop e o
 * callback sobe o array COMPLETO de ids — quem persiste é o app (metadado da
 * view em `page.data`, read-modify-write). Quando as props mudarem por fora
 * (persistência/realtime), o estado local re-sincroniza.
 *
 * SELEÇÃO: `selectedPagesIds` (array de ids) com intervalo por Shift — a
 * âncora é o último checkbox clicado; com Shift pressionado a área até a
 * linha sob o mouse ganha wash roxo, e o shift+click aplica o estado ao
 * intervalo inteiro. Toda mudança sobe por `onSelectionChange` (o terreno do
 * futuro batchRealtimeUpdate).
 */
export function TableView({ columns, rows, columnWidths, loading, emptyLabel = 'Nenhum registro.', onOpenRow, onCellChange, onColumnOptionsChange, onRowOrderChange, onColumnOrderChange, onSelectionChange, onColumnRename, onColumnWidthChange, labels }: TableViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sensors = useSortableSensors()
  const shiftHeld = useShiftKey()

  // Ordem otimista local (linhas e colunas), re-sincronizada quando a prop
  // muda — o mesmo padrão das options no SelectCellEditor.
  const [localRows, setLocalRows] = useState(rows)
  const [localColumns, setLocalColumns] = useState(columns)
  const [localWidths, setLocalWidths] = useState(columnWidths ?? {})
  useEffect(() => setLocalRows(rows), [rows])
  useEffect(() => setLocalColumns(columns), [columns])
  useEffect(() => {
    const incoming = columnWidths ?? {}
    latestWidthsRef.current = incoming
    setLocalWidths(incoming)
  }, [columnWidths])

  // Seleção: array exposto + âncora/hover do intervalo com Shift.
  const [selectedPagesIds, setSelectedPagesIds] = useState<string[]>([])
  const anchorIndexRef = useRef<number | null>(null)
  const [shiftHoverIndex, setShiftHoverIndex] = useState<number | null>(null)

  const [columnMenu, setColumnMenu] = useState<{ columnId: string; left: number } | null>(null)

  const columnTypes = useMemo(
    () => resolveColumnTypes(localColumns, localRows),
    [localColumns, localRows],
  )

  const rowsSortable = Boolean(onRowOrderChange)
  const columnsSortable = Boolean(onColumnOrderChange)
  const columnsResizable = Boolean(onColumnWidthChange)

  const applySelection = (next: string[]) => {
    setSelectedPagesIds(next)
    onSelectionChange?.(next)
  }

  /**
   * Estado do "selecionar todas" — só existe quando JÁ há seleção: a caixa
   * aparece no header a partir da primeira linha marcada, e some junto com a
   * última. `indeterminate` é o caso "algumas" (estado de apresentação de um
   * agregado, exatamente o que o Checkbox do pacote reserva ao modo state).
   */
  const allSelected = localRows.length > 0 && selectedPagesIds.length === localRows.length
  const headerCheckedState: CheckedState = allSelected ? true : 'indeterminate'

  const toggleSelectAll = (checked: boolean) => {
    // Clicar no indeterminado resolve para MARCADO (regra do Radix), então
    // "limpar tudo" acontece no clique seguinte, com todas já marcadas.
    applySelection(checked ? localRows.map((row) => row.id) : [])
    anchorIndexRef.current = null
  }

  const setRowSelected = (rowIndex: number, checked: boolean, shiftKey: boolean) => {
    const anchor = anchorIndexRef.current
    // Shift+click com âncora: o estado clicado vale para o INTERVALO inteiro
    // [âncora, linha]. Sem shift (ou sem âncora), toggle da linha só.
    const range =
      shiftKey && anchor !== null
        ? localRows.slice(Math.min(anchor, rowIndex), Math.max(anchor, rowIndex) + 1)
        : [localRows[rowIndex]]

    const rangeIds = new Set(range.map((row) => row.id))
    const kept = selectedPagesIds.filter((id) => !rangeIds.has(id))
    applySelection(checked ? [...kept, ...range.map((row) => row.id)] : kept)
    anchorIndexRef.current = rowIndex
  }

  /** A linha está na área coberta pela seleção com Shift? */
  const inShiftRange = (rowIndex: number): boolean => {
    const anchor = anchorIndexRef.current
    if (!shiftHeld || anchor === null || shiftHoverIndex === null) return false
    return (
      rowIndex >= Math.min(anchor, shiftHoverIndex) &&
      rowIndex <= Math.max(anchor, shiftHoverIndex)
    )
  }

  const handleRowDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = localRows.findIndex((row) => row.id === active.id)
    const to = localRows.findIndex((row) => row.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(localRows, from, to)
    setLocalRows(next)
    onRowOrderChange?.(next.map((row) => row.id))
  }

  const handleColumnDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = localColumns.findIndex((column) => column.id === active.id)
    const to = localColumns.findIndex((column) => column.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(localColumns, from, to)
    setLocalColumns(next)
    onColumnOrderChange?.(next.map((column) => column.id))
  }

  // O ref espelha o estado porque o `onResizeEnd` precisa do valor MAIS NOVO:
  // ler `localWidths` da closure do render entrega a largura de um movimento
  // atrás, e é justamente a última que o usuário quer salvar.
  const latestWidthsRef = useRef(localWidths)

  const handleColumnResize = (columnId: string, width: number) => {
    const next = { ...latestWidthsRef.current, [columnId]: resolveColumnWidth(width) }
    latestWidthsRef.current = next
    setLocalWidths(next)
  }

  const handleHeaderContextMenu = (columnId: string, event: MouseEvent<HTMLDivElement>) => {
    // O menu só existe com rename habilitado — sem callback, botão direito
    // segue com o menu nativo do browser (tabela "burra" continua burra).
    if (!onColumnRename) return
    event.preventDefault()
    const containerRect = containerRef.current?.getBoundingClientRect()
    const cellRect = event.currentTarget.getBoundingClientRect()
    setColumnMenu({ columnId, left: containerRect ? cellRect.left - containerRect.left : 0 })
  }

  const menuColumn = columnMenu
    ? localColumns.find((column) => column.id === columnMenu.columnId)
    : undefined

  return (
    <div ref={containerRef} className="relative">
      <div role="table" className="overflow-x-auto" onMouseLeave={() => setShiftHoverIndex(null)}>
        <div role="row" className="flex w-max min-w-full border-b border-divider">
          {/* Célula de controles do header: espaçador enquanto não há seleção
              (o alinhamento com as linhas depende da MESMA largura) e caixa de
              "selecionar todas" a partir da primeira linha marcada. */}
          <div
            className={cn('flex shrink-0 items-center px-2', CONTROL_CELL_WIDTH)}
            aria-hidden={selectedPagesIds.length === 0}
          >
            {selectedPagesIds.length > 0 && (
              <Checkbox
                aria-label={labels?.selectAll ?? 'Selecionar todas'}
                checked={headerCheckedState}
                onCheckedChange={toggleSelectAll}
                className="cursor-pointer"
              />
            )}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
            <SortableContext
              items={localColumns.map((column) => column.id)}
              strategy={horizontalListSortingStrategy}
            >
              {localColumns.map((column, columnIndex) => (
                <SortableHeaderCell
                  key={column.id}
                  column={column}
                  columnType={columnTypes[column.id]}
                  width={localWidths[column.id]}
                  sortable={columnsSortable}
                  resizable={columnsResizable}
                  isLast={columnIndex === localColumns.length - 1}
                  dragLabel={labels?.dragColumn ?? 'Arrastar coluna'}
                  resizeLabel={labels?.resizeColumn ?? 'Redimensionar coluna'}
                  onResize={(width) => handleColumnResize(column.id, width)}
                  onResizeEnd={() => onColumnWidthChange?.(latestWidthsRef.current)}
                  onContextMenu={(event) => handleHeaderContextMenu(column.id, event)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {loading ? (
          <div aria-hidden>
            {[0, 1, 2, 3].map((skeletonIndex) => (
              <div
                key={skeletonIndex}
                className={cn('flex', skeletonIndex % 2 === 1 ? 'bg-contrast' : 'bg-background')}
              >
                <div className={cn('shrink-0', CONTROL_CELL_WIDTH)} />
                <div className="flex h-9 flex-1 items-center border-l border-divider px-3">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-active" />
                </div>
              </div>
            ))}
          </div>
        ) : localRows.length === 0 ? (
          <div className="flex">
            <div className={cn('shrink-0', CONTROL_CELL_WIDTH)} />
            <div className="flex-1 border-l border-divider px-3 py-8 text-center text-sm opacity-60">
              {emptyLabel}
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
            <SortableContext
              items={localRows.map((row) => row.id)}
              strategy={verticalListSortingStrategy}
            >
              {localRows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  row={row}
                  columns={localColumns}
                  columnWidths={localWidths}
                  columnTypes={columnTypes}
                  zebra={rowIndex % 2 === 1}
                  selected={selectedPagesIds.includes(row.id)}
                  onSelectedChange={(checked, shiftKey) =>
                    setRowSelected(rowIndex, checked, shiftKey)
                  }
                  sortable={rowsSortable}
                  inShiftRange={inShiftRange(rowIndex)}
                  onShiftHover={() => setShiftHoverIndex(rowIndex)}
                  onOpenRow={onOpenRow}
                  onCellChange={onCellChange}
                  onColumnOptionsChange={onColumnOptionsChange}
                  labels={labels}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {columnMenu && menuColumn ? (
        <ColumnHeaderMenu
          column={menuColumn}
          columnType={columnTypes[menuColumn.id]}
          typeIcon={TYPE_ICON[columnTypes[menuColumn.id]]}
          onClose={() => setColumnMenu(null)}
          onRename={
            onColumnRename ? (name) => onColumnRename(menuColumn.id, name) : undefined
          }
          labels={labels}
          className="top-9"
          style={{ left: columnMenu.left }}
        />
      ) : null}
    </div>
  )
}
