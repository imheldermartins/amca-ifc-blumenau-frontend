import { Icon } from '@iconify/react'
import { cn } from 'cubs-components'

import type { CellChange, ColumnDataType, ColumnOption, HeaderCol, RowData } from '../types'
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
        icon={value ? 'lucide:square-check' : 'lucide:square'}
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
  /** Presente = célula EDITÁVEL (despacha para o editor do cellMap). */
  onCellChange?: (change: CellChange) => void
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
 */
export function TableCell({
  column,
  row,
  columnType,
  width,
  isLast,
  onCellChange,
  onColumnOptionsChange,
  labels,
}: TableCellProps) {
  const cell = row.cells[column.id]
  const type = columnType ?? column.type ?? inferColumnType([cell?.value])
  const Editor = onCellChange ? CELL_EDITORS[type] : null

  if (Editor && onCellChange) {
    return (
      <div
        role="cell"
        // Sem padding próprio: cada editor preenche a célula inteira e traz o
        // seu (o TextField `plain` tem px-3; checkbox/select idem) — assim a
        // área clicável/focável é a célula toda, não uma ilha no meio.
        className={cn(
          'flex shrink-0 items-stretch border-l border-divider',
          isLast && 'border-r',
        )}
        style={{ width: resolveColumnWidth(width) }}
      >
        <Editor
          column={column}
          rowId={row.id}
          value={cell?.value}
          onCommit={(value) =>
            onCellChange({
              rowId: row.id,
              columnId: column.id,
              value,
              previousValue: cell?.value,
            })
          }
          onOptionsChange={
            onColumnOptionsChange
              ? (options) => onColumnOptionsChange(column.id, options)
              : undefined
          }
          labels={labels}
        />
      </div>
    )
  }

  return (
    <div
      role="cell"
      className={cn(
        'flex shrink-0 items-center border-l border-divider px-3 py-2 text-sm',
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
}
