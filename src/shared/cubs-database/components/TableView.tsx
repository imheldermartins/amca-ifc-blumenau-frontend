import { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import {
  EMPTY_SELECTION,
  inShiftRange,
  selectionReducer,
} from './selectionReducer'

export interface TableViewProps {
  columns: HeaderCol[]
  rows: RowData[]
  /**
   * `columnWidths` da view: largura em px por ID de coluna. Uma única fonte
   * para header e células — sem isso as duas grades divergem.
   */
  columnWidths?: Record<string, number>
  /** Células cuja escrita falhou (chave `cellErrorKey`) — moldura de erro. */
  cellErrors?: Set<string>
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
const SortableHeaderCell = memo(function SortableHeaderCell({
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
  onResize: (columnId: string, width: number) => void
  /** Soltou: hora de persistir. */
  onResizeEnd: () => void
  onContextMenu?: (columnId: string, event: MouseEvent<HTMLDivElement>) => void
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
    onResize(column.id, start.width + (event.clientX - start.x))
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
      onContextMenu={onContextMenu ? (event) => onContextMenu(column.id, event) : undefined}
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
})

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
 * SELEÇÃO: um `useReducer` (`selectionReducer`) com os ids num `Set` e a
 * âncora/hover do intervalo com Shift no mesmo estado. `dispatch` é estável,
 * o que mantém os handlers das linhas com identidade fixa — condição para o
 * `memo` do `TableRow` valer alguma coisa.
 *
 * **Sobre a memoização em geral:** os componentes abaixo (`TableRow`,
 * `TableCell`, os editores do cellMap) são `React.memo`, e comparação rasa
 * morre com função recriada a cada render. Por isso todo handler que desce
 * daqui é `useCallback`, e o que precisaria de closure por linha (o índice)
 * virou parâmetro — a closure é montada DENTRO da linha, onde não cruza
 * fronteira de memo e sai de graça.
 */
export function TableView({ columns, rows, columnWidths, cellErrors, loading, emptyLabel = 'Nenhum registro.', onOpenRow, onCellChange, onColumnOptionsChange, onRowOrderChange, onColumnOrderChange, onSelectionChange, onColumnRename, onColumnWidthChange, labels }: TableViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sensors = useSortableSensors()
  const shiftHeld = useShiftKey()

  // Ordem otimista local (linhas, colunas e larguras), re-sincronizada quando
  // a prop muda.
  //
  // A sincronização acontece DURANTE O RENDER, comparando com a prop já vista
  // — não num `useEffect`. O efeito custava DOIS renders por mudança de prop
  // (um com o estado velho, outro depois do efeito); o ajuste em render faz o
  // React reexecutar o componente na hora, sem commitar o intermediário. É o
  // padrão documentado para "estado derivado de prop".
  const [localRows, setLocalRows] = useState(rows)
  const [localColumns, setLocalColumns] = useState(columns)
  const [localWidths, setLocalWidths] = useState(columnWidths ?? {})
  const [seenProps, setSeenProps] = useState({ rows, columns, columnWidths })

  // O ref espelha o estado porque o `onResizeEnd` precisa do valor MAIS NOVO:
  // ler `localWidths` da closure do render entrega a largura de um movimento
  // atrás, e é justamente a última que o usuário quer salvar.
  const latestWidthsRef = useRef(localWidths)

  if (seenProps.rows !== rows || seenProps.columns !== columns || seenProps.columnWidths !== columnWidths) {
    setSeenProps({ rows, columns, columnWidths })
    if (seenProps.rows !== rows) setLocalRows(rows)
    if (seenProps.columns !== columns) setLocalColumns(columns)
    if (seenProps.columnWidths !== columnWidths) {
      const incoming = columnWidths ?? {}
      latestWidthsRef.current = incoming
      setLocalWidths(incoming)
    }
  }

  const [selection, dispatch] = useReducer(selectionReducer, EMPTY_SELECTION)
  const [columnMenu, setColumnMenu] = useState<{ columnId: string; left: number } | null>(null)

  const rowIds = useMemo(() => localRows.map((row) => row.id), [localRows])

  const columnTypes = useMemo(
    () => resolveColumnTypes(localColumns, localRows),
    [localColumns, localRows],
  )

  const rowsSortable = Boolean(onRowOrderChange)
  const columnsSortable = Boolean(onColumnOrderChange)
  const columnsResizable = Boolean(onColumnWidthChange)

  // A seleção sobe por efeito, e não de dentro do redutor: chamar callback do
  // host numa função que precisa ser pura quebraria o StrictMode (que a
  // executa duas vezes). O ref pula o disparo do mount — montar a tabela não
  // é "a seleção mudou".
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    onSelectionChange?.([...selection.ids])
  }, [selection.ids, onSelectionChange])

  /**
   * Estado do "selecionar todas" — só existe quando JÁ há seleção: a caixa
   * aparece no header a partir da primeira linha marcada, e some junto com a
   * última. `indeterminate` é o caso "algumas" (estado de apresentação de um
   * agregado, exatamente o que o Checkbox do pacote reserva ao modo state).
   */
  const allSelected = localRows.length > 0 && selection.ids.size === localRows.length
  const headerCheckedState: CheckedState = allSelected ? true : 'indeterminate'

  const toggleSelectAll = useCallback(
    (checked: boolean) => dispatch({ type: 'select-all', checked, rowIds }),
    [rowIds],
  )

  const handleRowSelectedChange = useCallback(
    (rowIndex: number, checked: boolean, shiftKey: boolean) =>
      dispatch({ type: 'set-row', rowIndex, checked, shiftKey, rowIds }),
    [rowIds],
  )

  const handleRowHover = useCallback(
    (rowIndex: number) => dispatch({ type: 'hover', rowIndex }),
    [],
  )

  const handleMouseLeave = useCallback(() => dispatch({ type: 'hover', rowIndex: null }), [])

  const handleRowDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return
      setLocalRows((current) => {
        const from = current.findIndex((row) => row.id === active.id)
        const to = current.findIndex((row) => row.id === over.id)
        if (from < 0 || to < 0) return current
        const next = arrayMove(current, from, to)
        onRowOrderChange?.(next.map((row) => row.id))
        return next
      })
    },
    [onRowOrderChange],
  )

  const handleColumnDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return
      setLocalColumns((current) => {
        const from = current.findIndex((column) => column.id === active.id)
        const to = current.findIndex((column) => column.id === over.id)
        if (from < 0 || to < 0) return current
        const next = arrayMove(current, from, to)
        onColumnOrderChange?.(next.map((column) => column.id))
        return next
      })
    },
    [onColumnOrderChange],
  )

  const handleColumnResize = useCallback((columnId: string, width: number) => {
    const next = { ...latestWidthsRef.current, [columnId]: resolveColumnWidth(width) }
    latestWidthsRef.current = next
    setLocalWidths(next)
  }, [])

  const handleColumnResizeEnd = useCallback(
    () => onColumnWidthChange?.(latestWidthsRef.current),
    [onColumnWidthChange],
  )

  const handleHeaderContextMenu = useCallback(
    (columnId: string, event: MouseEvent<HTMLDivElement>) => {
      // O menu só existe com rename habilitado — sem callback, botão direito
      // segue com o menu nativo do browser (tabela "burra" continua burra).
      if (!onColumnRename) return
      event.preventDefault()
      const containerRect = containerRef.current?.getBoundingClientRect()
      const cellRect = event.currentTarget.getBoundingClientRect()
      setColumnMenu({ columnId, left: containerRect ? cellRect.left - containerRect.left : 0 })
    },
    [onColumnRename],
  )

  const closeColumnMenu = useCallback(() => setColumnMenu(null), [])

  const menuColumn = columnMenu
    ? localColumns.find((column) => column.id === columnMenu.columnId)
    : undefined

  const handleMenuRename = useCallback(
    (name: string) => {
      if (columnMenu) onColumnRename?.(columnMenu.columnId, name)
    },
    [columnMenu, onColumnRename],
  )

  return (
    <div ref={containerRef} className="relative">
      <div role="table" className="overflow-x-auto" onMouseLeave={handleMouseLeave}>
        <div role="row" className="flex w-max min-w-full border-b border-divider">
          {/* Célula de controles do header: espaçador enquanto não há seleção
              (o alinhamento com as linhas depende da MESMA largura) e caixa de
              "selecionar todas" a partir da primeira linha marcada. */}
          <div
            className={cn('flex shrink-0 items-center px-2', CONTROL_CELL_WIDTH)}
            aria-hidden={selection.ids.size === 0}
          >
            {selection.ids.size > 0 && (
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
                  onResize={handleColumnResize}
                  onResizeEnd={handleColumnResizeEnd}
                  onContextMenu={handleHeaderContextMenu}
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
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {localRows.map((row, rowIndex) => (
                <TableRow
                  key={row.id}
                  row={row}
                  rowIndex={rowIndex}
                  columns={localColumns}
                  columnWidths={localWidths}
                  columnTypes={columnTypes}
                  cellErrors={cellErrors}
                  zebra={rowIndex % 2 === 1}
                  selected={selection.ids.has(row.id)}
                  onSelectedChange={handleRowSelectedChange}
                  sortable={rowsSortable}
                  inShiftRange={inShiftRange(selection, rowIndex, shiftHeld)}
                  onShiftHover={handleRowHover}
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
          onClose={closeColumnMenu}
          onRename={onColumnRename ? handleMenuRename : undefined}
          labels={labels}
          className="top-9"
          style={{ left: columnMenu.left }}
        />
      ) : null}
    </div>
  )
}
