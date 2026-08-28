import { memo, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'

import type {
  CellChange,
  CellEditConflict,
  ColumnDataType,
  ColumnOption,
  HeaderCol,
  RowData,
} from '../types'
import { formatCellValue, formatNumericValue, inferColumnType, resolveColumnWidth } from '../utils'
import { CELL_EDITORS } from './cells'
import { OptionChip } from './cells/OptionChip'

function CellValue({
  type,
  value,
  column,
}: {
  type: ColumnDataType
  value: unknown
  column: HeaderCol
}) {
  if (type === 'checkbox') {
    return (
      <Icon
        icon={value ? 'lucide:circle-check' : 'lucide:circle'}
        fontSize={16}
        className={cn('shrink-0', value ? 'text-p-green' : 'opacity-40')}
      />
    )
  }
  if (type === 'select') {
    // A célula guarda o ID da option; o rótulo/cor saem das `options` da
    // coluna. Id órfão (option apagada) vira célula vazia — melhor que um
    // id cru na tela.
    const option =
      typeof value === 'string' ? column.options?.find((entry) => entry.id === value) : undefined
    if (!option) {
      return <span className="opacity-60">—</span>
    }
    return <OptionChip option={option} />
  }
  if (type === 'numeric' && column.format) {
    // O `format` vale nos DOIS modos: o read-only exibe o MESMO texto que o
    // editor ("R$ 1.299,00" / "42%"), não o número cru do armazenamento.
    return <span className="truncate tabular-nums">{formatNumericValue(value, column.format)}</span>
  }
  return (
    <span className={cn('truncate', type === 'numeric' && 'tabular-nums')}>
      {formatCellValue(value)}
    </span>
  )
}

function formatConflictValue(type: ColumnDataType, value: unknown, column: HeaderCol): string {
  if (type === 'select' && typeof value === 'string') {
    return column.options?.find((option) => option.id === value)?.label ?? formatCellValue(value)
  }
  if (type === 'numeric' && column.format) return formatNumericValue(value, column.format)
  return formatCellValue(value)
}

export interface TableCellProps {
  column: HeaderCol
  row: RowData
  /**
   * Tipo já resolvido no nível da tabela (`resolveColumnTypes`) — é o que o
   * header usou para o ícone. Sem ele, a célula resolve sozinha: type
   * declarado na coluna, senão inferido do PRÓPRIO valor.
   */
  columnType?: ColumnDataType
  /** Largura (px) vinda de `columnWidths` da view; ausente = default. */
  width?: number
  /** Última coluna da linha: fecha a grade com a borda direita (como o header). */
  isLast?: boolean
  /** Falha/impasse nesta célula — wash vermelho, moldura e `aria-invalid`. */
  hasError?: boolean
  /** Presente = célula EDITÁVEL (despacha para o editor do cellMap). */
  onCellChange?: (change: CellChange) => void
  /** O receiver interrompeu uma edição ativa e aplicou o valor externo. */
  onCellEditConflict?: (conflict: CellEditConflict) => void
  /** Reordenação das options de uma coluna select (array completo). */
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  /** Rótulos de a11y dos editores (injetados pelo app host). */
  labels?: { dragOption?: string }
}

/**
 * Célula: renderiza `cells[col.id].value` com o TIPO vindo da coluna — se ela
 * não declara um, o tipo é inferido dos valores. Quando a linha NÃO tem valor
 * para a coluna (`cells[col.id]` ausente), a célula vira um `div` vazio só
 * para preencher o espaço — mantém o alinhamento da grade sem exibir um valor
 * enganoso (ex.: o checkbox desmarcado, que pareceria um `false` real).
 *
 * MODO EDITÁVEL: com `onCellChange` presente, a célula despacha para o editor
 * do tipo no `CELL_EDITORS` (o cellMap) — tipo sem editor (date, por ora) cai
 * no render read-only. É o editor quem decide QUANDO commitar; a célula só
 * monta o `CellChange` (id da linha/coluna + valor anterior) e sobe.
 *
 * A largura é FIXA (`shrink-0` + width em px), nunca elástica: com `flex-1` a
 * coluna dependeria de quantas células a linha tem, e uma linha sem valor para
 * a última coluna desalinhava da grade do header.
 *
 * `React.memo` + os dois `useCallback` abaixo são o que faz o `memo` dos
 * editores (o cellMap) valer alguma coisa. Antes o `onCommit` era uma arrow
 * inline recriada a cada render: o editor era `React.memo`, comparava props,
 * via uma função com identidade nova e re-renderizava assim mesmo. O memo
 * existia e não fazia nada.
 */
export const TableCell = memo(function TableCell({
  column,
  row,
  columnType,
  width,
  isLast,
  hasError,
  onCellChange,
  onCellEditConflict,
  onColumnOptionsChange,
  labels,
}: TableCellProps) {
  const cell = row.cells[column.id]
  const type = columnType ?? column.type ?? inferColumnType([cell?.value])
  const Editor = onCellChange ? CELL_EDITORS[type] : null

  const previousValue = cell?.value

  const handleCommit = useCallback(
    (value: unknown) =>
      onCellChange?.({ rowId: row.id, columnId: column.id, value, previousValue }),
    [onCellChange, row.id, column.id, previousValue],
  )

  const handleOptionsChange = useCallback(
    (options: ColumnOption[]) => onColumnOptionsChange?.(column.id, options),
    [onColumnOptionsChange, column.id],
  )

  const handleExternalConflict = useCallback(
    () =>
      onCellEditConflict?.({
        rowId: row.id,
        columnId: column.id,
        columnTitle: column.title,
        value: previousValue,
        displayValue: formatConflictValue(type, previousValue, column),
      }),
    [onCellEditConflict, row.id, column, type, previousValue],
  )

  if (Editor && onCellChange) {
    return (
      <div
        role="cell"
        // Sem padding próprio: cada editor preenche a célula inteira e traz o
        // seu (o TextField `plain` tem padding compacto; checkbox/select idem) — assim a
        // área clicável/focável é a célula toda, não uma ilha no meio.
        //
        // A moldura de erro fica no CONTAINER (um lugar, cobre os 4 tipos de
        // editor) em vez de em cada editor: um anel interno p-red que não
        // desloca o layout (`ring-inset`). O `aria-invalid` vai no editor.
        className={cn(
          'flex shrink-0 items-stretch border-l border-divider',
          isLast && 'border-r',
          hasError && 'bg-p-red-500/10 ring-1 ring-inset ring-p-red dark:bg-p-red-500/15',
        )}
        style={{ width: resolveColumnWidth(width) }}
      >
        <Editor
          column={column}
          rowId={row.id}
          value={previousValue}
          onCommit={handleCommit}
          onExternalConflict={handleExternalConflict}
          onOptionsChange={onColumnOptionsChange ? handleOptionsChange : undefined}
          hasError={hasError}
          labels={labels}
        />
      </div>
    )
  }

  return (
    <div
      role="cell"
      className={cn(
        'flex shrink-0 items-center border-l border-divider px-2.5 py-1.5 text-sm',
        isLast && 'border-r',
      )}
      style={{ width: resolveColumnWidth(width) }}
    >
      {cell ? (
        <CellValue type={type} value={cell.value} column={column} />
      ) : (
        // Preenche o box inteiro da célula: largura cheia + estica na altura da
        // linha, com uma linha de texto de altura mínima para não colapsar
        // mesmo numa linha em que todas as células estejam vazias.
        <div aria-hidden className="min-h-5 w-full self-stretch" />
      )}
    </div>
  )
})
