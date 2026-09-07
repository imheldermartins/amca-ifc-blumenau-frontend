import type { ComponentType } from 'react'

import type { CellEditorProps, ColumnDataType } from '../../types'
import { CheckboxCellEditor } from './CheckboxCellEditor'
import { DateCellEditor } from './DateCellEditor'
import { NumericCellEditor } from './NumericCellEditor'
import { SelectCellEditor } from './SelectCellEditor'
import { TextCellEditor } from './TextCellEditor'

export type CellEditor = ComponentType<CellEditorProps> | null

/**
 * O cellMap: TIPO de coluna → editor de célula. É a tabela de despacho do
 * `TableCell` no modo editável — nenhum consumidor conhece editor por nome, só
 * o tipo.
 *
 * Todos os editores são `React.memo` de propósito: é o terreno do realtime —
 * quando o store por célula existir, só a célula cujo valor mudou re-renderiza.
 */
export const CELL_EDITORS: Record<ColumnDataType, CellEditor> = {
  text: TextCellEditor,
  numeric: NumericCellEditor,
  select: SelectCellEditor,
  checkbox: CheckboxCellEditor,
  date: DateCellEditor,
}

export { CheckboxCellEditor } from './CheckboxCellEditor'
export { DateCellEditor } from './DateCellEditor'
export { NumericCellEditor } from './NumericCellEditor'
export { SelectCellEditor } from './SelectCellEditor'
export { TextCellEditor } from './TextCellEditor'
export { OptionChip } from './OptionChip'
export { OPTION_COLOR_CLASSES } from './optionColors'
