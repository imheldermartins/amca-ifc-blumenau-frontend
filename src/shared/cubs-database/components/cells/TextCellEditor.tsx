import { memo, useEffect, useRef, useState } from 'react'
import { TextField } from 'cubs-components'

import type { CellEditorProps } from '../../types'

/**
 * Editor de célula `text`: um TextField `plain` (sem borda/ring/fundo — a
 * célula continua parecendo texto) com o ciclo de commit padrão dos editores:
 *
 *   blur   → confirma (se o valor mudou)
 *   Enter  → blur (que confirma)
 *   Escape → reverte para o valor externo e faz blur SEM confirmar
 *
 * O rascunho é estado local sincronizado com `value` — quando o valor externo
 * mudar por fora (o futuro broadcast do realtime), a célula acompanha sem
 * precisar remontar.
 */
export const TextCellEditor = memo(function TextCellEditor({
  column,
  value,
  onCommit,
}: CellEditorProps) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value)
  const [draft, setDraft] = useState(text)
  // Escape marca o flag e dispara blur: o handler de blur lê o flag (e não o
  // state, que ainda seria o do render antigo) para saber que NÃO deve commitar.
  const skipCommitRef = useRef(false)

  useEffect(() => setDraft(text), [text])

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }
    const next = draft.trim()
    if (next === text) return
    onCommit(next === '' ? null : next)
  }

  return (
    <TextField
      aria-label={column.title}
      surface="plain"
      size="sm"
      className="w-full"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          skipCommitRef.current = true
          setDraft(text)
          event.currentTarget.blur()
        }
      }}
    />
  )
})
