import { useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { Checkbox, cn } from 'cubs-components'

import type { CellChange, ColumnDataType, ColumnOption, HeaderCol, RowData } from '../types'
import type { ColumnHeaderMenuLabels } from './ColumnHeaderMenu'
import { TableCell } from './TableCell'

/** Largura da célula de controles — o header usa o MESMO valor para alinhar. */
export const CONTROL_CELL_WIDTH = 'w-24'

export interface TableRowLabels extends ColumnHeaderMenuLabels {
  drag?: string
  select?: string
  /** Label do "selecionar todas" (header; só aparece com seleção ativa). */
  selectAll?: string
  /** Label do botão de abrir a página (ex.: "Abrir"). */
  open?: string
  /** Label do drag handle de uma option no editor de select. */
  dragOption?: string
  /** Label do drag handle de uma COLUNA (header). */
  dragColumn?: string
  /** Label da alça de redimensionar coluna. */
  resizeColumn?: string
}

export interface TableRowProps {
  row: RowData
  columns: HeaderCol[]
  /** `columnWidths` da view (px por ID de coluna) — o header usa o MESMO mapa. */
  columnWidths?: Record<string, number>
  /** Tipos resolvidos por ID de coluna — o header usa o MESMO mapa. */
  columnTypes?: Record<string, ColumnDataType>
  /** true = linha "listrada" (bg-contrast); false = bg-background. */
  zebra: boolean
  selected: boolean
  /** Toggle do checkbox; `shiftKey` liga a seleção em INTERVALO. */
  onSelectedChange: (checked: boolean, shiftKey: boolean) => void
  /** true = drag de LINHA habilitado (o handle vira activator do sortable). */
  sortable?: boolean
  /** true = a linha está na área coberta pelo shift → wash roxo. */
  inShiftRange?: boolean
  /** Mouse entrou na linha — o TableView rastreia o alvo do intervalo. */
  onShiftHover?: () => void
  /** Clique no botão "Abrir ›" da célula de controles — recebe a row crua. */
  onOpenRow?: (row: RowData) => void
  /** Presente = células editáveis (ver o cellMap em `components/cells`). */
  onCellChange?: (change: CellChange) => void
  /** Reordenação das options de uma coluna select (array completo). */
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  labels?: TableRowLabels
}

/**
 * Linha da tabela em zebra striping — linhas contíguas, não cards. A PRIMEIRA
 * célula é estática (posição zero, dentro da zebra) e carrega os controles:
 * drag-handle + checkbox + botão "Abrir ›"; aparecem no hover da linha e
 * ficam fixos quando ela está selecionada.
 *
 * A linha é um sortable do dnd-kit com o drag handle como ACTIVATOR — clicar
 * no resto da linha nunca inicia drag. `sortable` ausente = `disabled` no
 * sensor, e o handle volta a ser decorativo.
 */
export function TableRow({ row, columns, columnWidths, columnTypes, zebra, selected, onSelectedChange, sortable, inShiftRange, onShiftHover, onOpenRow, onCellChange, onColumnOptionsChange, labels }: TableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled: !sortable })

  // O Radix não repassa o MouseEvent no onCheckedChange, então o shift é
  // capturado ANTES (capture phase do click no wrapper) e lido em seguida.
  const shiftClickRef = useRef(false)

  return (
    <div
      role="row"
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onMouseEnter={onShiftHover}
      className={cn(
        'group/row flex w-max min-w-full items-stretch',
        zebra ? 'bg-contrast' : 'bg-background',
        // Área coberta pela seleção com Shift (âncora → linha sob o mouse).
        inShiftRange && 'bg-p-purple-500/10 dark:bg-p-purple-500/15',
        isDragging && 'relative z-10 opacity-80',
      )}
    >
      <div
        role="cell"
        className={cn(
          'flex shrink-0 items-center gap-1',
          CONTROL_CELL_WIDTH,
          'transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-within:opacity-100',
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={labels?.drag ?? 'Arrastar linha'}
          {...(sortable ? { ...attributes, ...listeners } : {})}
          className="cursor-grab rounded px-0.5 py-1 opacity-60 transition-colors hover:bg-active hover:opacity-100"
        >
          <Icon icon="lucide:grip-vertical" />
        </button>
        <span onClickCapture={(event) => (shiftClickRef.current = event.shiftKey)}>
          <Checkbox
            aria-label={labels?.select ?? 'Selecionar linha'}
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(checked, shiftClickRef.current)}
            className="cursor-pointer"
          />
        </span>
        <button
          type="button"
          onClick={() => onOpenRow?.(row)}
          className="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs opacity-70 transition-colors hover:opacity-100 cursor-pointer"
        >
          {labels?.open ?? 'Abrir'}
          <Icon icon="lucide:chevron-right" className="shrink-0" />
        </button>
      </div>

      {columns.map((column, columnIndex) => (
        <TableCell
          key={column.id}
          column={column}
          row={row}
          columnType={columnTypes?.[column.id]}
          width={columnWidths?.[column.id]}
          isLast={columnIndex === columns.length - 1}
          onCellChange={onCellChange}
          onColumnOptionsChange={onColumnOptionsChange}
          labels={labels}
        />
      ))}
    </div>
  )
}
