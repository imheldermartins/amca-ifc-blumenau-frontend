import { memo, useCallback } from 'react'
import { Icon } from '@iconify/react'
import { cn, formatDatePickerValue } from 'cubs-components'

import type {
  CellChange,
  CellEditConflict,
  CellEditorLabels,
  ColumnDataType,
  ColumnOption,
  HeaderCol,
  RowData,
} from '../types'
import { formatCellValue, formatNumericValue, inferColumnType, resolveColumnWidth } from '../utils'
import { CELL_EDITORS } from './cells'
import { OptionChip } from './cells/OptionChip'
import { FlowActionButton } from './FlowActionButton'

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
      <span className="flex w-full flex-1 items-center justify-center">
        <Icon
          icon={value ? 'lucide:circle-check' : 'lucide:circle'}
          fontSize={16}
          className={cn('shrink-0', value ? 'text-p-green' : 'opacity-40')}
        />
      </span>
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
  if (type === 'date') {
    return <span className="truncate tabular-nums">{formatDatePickerValue(value)}</span>
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
  if (type === 'date') return formatDatePickerValue(value)
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
  /** Mantém a aparência normal, mas remove o editor e explica a restrição. */
  locked?: boolean
  /** Flow não é editor de valor: abre a preview/modal e a API executa. */
  onFlowOpen?: (row: RowData, column: HeaderCol) => void
  /** Presente = célula EDITÁVEL (despacha para o editor do cellMap). */
  onCellChange?: (change: CellChange) => void
  /** O receiver interrompeu uma edição ativa e aplicou o valor externo. */
  onCellEditConflict?: (conflict: CellEditConflict) => void
  /** Reordenação das options de uma coluna select (array completo). */
  onColumnOptionsChange?: (columnId: string, options: ColumnOption[]) => void
  /** Rótulos de a11y dos editores (injetados pelo app host). */
  labels?: CellEditorLabels
}

/**
 * Célula: renderiza `cells[col.id].value` com o TIPO vindo da coluna — se ela
 * não declara um, o tipo é inferido dos valores. Quando a linha NÃO tem valor
 * para a coluna (`cells[col.id]` ausente), a célula vira um `div` vazio só
 * para preencher o espaço — mantém o alinhamento da grade sem exibir um valor
 * enganoso (ex.: o checkbox desmarcado, que pareceria um `false` real).
 *
 * MODO EDITÁVEL: com `onCellChange` presente, a célula despacha para o editor
 * do tipo no `CELL_EDITORS` (o cellMap). É o editor quem decide QUANDO
 * commitar; a célula só
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
  locked,
  onFlowOpen,
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

  if (type === 'flow') {
    const nodes = column.flow?.nodes ?? []
    const shown = nodes.slice(0, 4)
    const canExecute = Boolean(onFlowOpen && column.flow && !locked)
    return (
      <div
        role="cell"
        title={locked ? 'Coluna bloqueada' : undefined}
        className={cn(
          'flex shrink-0 items-center overflow-clip border-l border-divider p-2 pb-2.5 text-sm',
          isLast && 'border-r',
        )}
        style={{ width: resolveColumnWidth(width) }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {shown.length > 0 ? shown.map((node, index) => (
            <span key={node.id} className="contents">
              {index > 0 && <Icon icon="lucide:chevron-right" className="size-3 shrink-0 opacity-35" />}
              <span className={cn(
                'shrink-0 rounded-md border border-divider px-1.5 py-0.5 text-[10px] font-medium leading-4',
                (node.type === 'start' || node.type === 'callback') && 'rounded-full border-foreground/20 bg-foreground text-background',
              )}>
                {node.type === 'start' ? 'Início' : node.type === 'email' ? 'E-mail' : node.type === 'set_value' ? 'Atualizar' : node.type === 'switch' ? 'Condição' : 'Retorno'}
              </span>
            </span>
          )) : <span className="truncate text-xs opacity-45">Flow não configurado</span>}
          {nodes.length > shown.length && <span className="shrink-0 text-xs opacity-45">+{nodes.length - shown.length}</span>}
        </div>
        {canExecute && (
          <FlowActionButton column={column} onClick={() => onFlowOpen?.(row, column)} />
        )}
        {locked && <Icon icon="lucide:lock-keyhole" className="ml-2 size-3 shrink-0 opacity-40" aria-label="Coluna bloqueada" />}
      </div>
    )
  }

  if (Editor && onCellChange && !locked) {
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
          type === 'checkbox' && 'items-center justify-center',
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
      title={locked ? 'Coluna bloqueada' : undefined}
      className={cn(
        'flex shrink-0 items-center border-l border-divider px-2.5 py-1.5 text-sm',
        type === 'checkbox' && 'justify-center',
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
      {locked && <Icon icon="lucide:lock-keyhole" className="ml-auto size-3 shrink-0 opacity-40" aria-label="Coluna bloqueada" />}
    </div>
  )
})
