import { memo } from 'react'
import { TextField, unmask, unmaskCurrencyCents } from 'cubs-components'

import type { CellEditorProps, NumberFormat } from '../../types'
import { formatNumericValue } from '../../utils'
import { useExternalDraft } from './useExternalDraft'

/** Caminho de volta: texto do campo → valor numérico cru. `null` = ilegível. */
function parseDraft(draft: string, format: NumberFormat | undefined): number | null {
  if (format === 'currency') return unmaskCurrencyCents(draft)
  if (format === 'percentage') {
    const digits = unmask(draft)
    return digits === '' ? null : Number(digits)
  }
  // Livre: aceita vírgula decimal (pt-BR); o que não vira número é descartado.
  const parsed = Number(draft.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Editor de célula `numeric`: mesmo TextField `plain` e mesmo ciclo de commit
 * do editor de texto (blur confirma, Enter → blur, Escape reverte), mas a
 * MÁSCARA é o `format` da coluna — exatamente o que o dado da coluna declara.
 * Sem format, o campo é livre (`inputMode="decimal"`) e valida no commit:
 * rascunho ilegível reverte em vez de gravar lixo.
 */
export const NumericCellEditor = memo(function NumericCellEditor({
  column,
  value,
  onCommit,
  hasError,
}: CellEditorProps) {
  const initial = formatNumericValue(value, column.format)
  const field = useExternalDraft(initial)

  const commit = () => {
    // `settle()` false = o usuário não editou (e o rascunho já se realinhou ao
    // valor externo). Commitar aqui reverteria a edição de outra pessoa.
    if (!field.settle()) return

    if (field.draft.trim() === '') {
      if (value != null) onCommit(null)
      return
    }
    const next = parseDraft(field.draft, column.format)
    if (next === null) {
      field.revert() // ilegível → reverte
      return
    }
    if (next !== value) onCommit(next)
  }

  return (
    <TextField
      aria-label={column.title}
      aria-invalid={hasError || undefined}
      surface="plain"
      size="sm"
      className="w-full"
      inputClassName="tabular-nums"
      inputMode={column.format ? 'numeric' : 'decimal'}
      mask={column.format}
      value={field.draft}
      onFocus={field.focus}
      onChange={(event) => field.change(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          // `revert` limpa o "editado", então o blur seguinte não commita.
          field.revert()
          event.currentTarget.blur()
        }
      }}
    />
  )
})
