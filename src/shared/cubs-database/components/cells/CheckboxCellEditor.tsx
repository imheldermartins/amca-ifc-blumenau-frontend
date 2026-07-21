import { memo } from 'react'
import { Checkbox } from 'cubs-components'

import type { CellEditorProps } from '../../types'

/**
 * Editor de célula `checkbox`: toggle = commit imediato — não existe rascunho
 * nem blur aqui, o clique JÁ é a confirmação. Célula vazia (`undefined`) exibe
 * desmarcado, e o primeiro clique grava `true` (a partir daí a célula passa a
 * ter valor de verdade).
 */
export const CheckboxCellEditor = memo(function CheckboxCellEditor({
  column,
  value,
  onCommit,
}: CellEditorProps) {
  const checked = value === true

  return (
    <span className="flex items-center px-3 py-2">
      <Checkbox
        aria-label={column.title}
        checked={checked}
        onCheckedChange={(next) => {
          if (next !== checked) onCommit(next)
        }}
        className="cursor-pointer"
      />
    </span>
  )
})
