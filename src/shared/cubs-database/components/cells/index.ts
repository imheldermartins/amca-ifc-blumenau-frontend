import type { ComponentType } from 'react'

import type { CellEditorProps, ColumnDataType } from '../../types'
import { CheckboxCellEditor } from './CheckboxCellEditor'
import { NumericCellEditor } from './NumericCellEditor'
import { SelectCellEditor } from './SelectCellEditor'
import { TextCellEditor } from './TextCellEditor'

export type CellEditor = ComponentType<CellEditorProps> | null

/**
 * O cellMap: TIPO de coluna → editor de célula. É a tabela de despacho do
 * `TableCell` no modo editável — nenhum consumidor conhece editor por nome, só
 * o tipo. `null` documenta o tipo que AINDA não tem editor (cai no render
 * read-only), em vez de deixá-lo de fora e parecer esquecimento.
 *
 * Todos os editores são `React.memo` de propósito: é o terreno do realtime —
 * quando o store por célula existir, só a célula cujo valor mudou re-renderiza.
 */
export const CELL_EDITORS: Record<ColumnDataType, CellEditor> = {
  text: TextCellEditor,
  numeric: NumericCellEditor,
  select: SelectCellEditor,
  checkbox: CheckboxCellEditor,
  // Sem editor por ora: um date picker é um componente próprio (Popover +
  // calendário), fora do escopo desta leva.
  date: null,
}

export { CheckboxCellEditor } from './CheckboxCellEditor'
export { NumericCellEditor } from './NumericCellEditor'
export { SelectCellEditor } from './SelectCellEditor'
export { TextCellEditor } from './TextCellEditor'
export { OptionChip } from './OptionChip'
export { OPTION_COLOR_CLASSES } from './optionColors'
