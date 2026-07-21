import { memo, useEffect, useRef, useState } from 'react'
import { TextField, unmask, unmaskCurrencyCents } from 'cubs-components'

import type { CellEditorProps, NumberFormat } from '../../types'
import { formatNumericValue } from '../../utils'

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
}: CellEditorProps) {
  const initial = formatNumericValue(value, column.format)
  const [draft, setDraft] = useState(initial)
  const skipCommitRef = useRef(false)

  useEffect(() => setDraft(initial), [initial])

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }
    if (draft.trim() === '') {
      if (value != null) onCommit(null)
      return
    }
    const next = parseDraft(draft, column.format)
    if (next === null) {
      setDraft(initial) // ilegível → reverte
      return
    }
    if (next !== value) onCommit(next)
  }

  return (
    <TextField
      aria-label={column.title}
      surface="plain"
      size="sm"
      className="w-full"
      inputClassName="tabular-nums"
      inputMode={column.format ? 'numeric' : 'decimal'}
      mask={column.format}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          skipCommitRef.current = true
          setDraft(initial)
          event.currentTarget.blur()
        }
      }}
    />
  )
})
