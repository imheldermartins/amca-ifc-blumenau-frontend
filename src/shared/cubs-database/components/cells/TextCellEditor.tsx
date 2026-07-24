import { memo } from 'react'
import { TextField } from 'cubs-components'

import type { CellEditorProps } from '../../types'
import { useExternalDraft } from './useExternalDraft'

/**
 * Editor de célula `text`: um TextField `plain` (sem borda/ring/fundo — a
 * célula continua parecendo texto) com o ciclo de commit padrão dos editores:
 *
 *   blur   → confirma (se o valor mudou)
 *   Enter  → blur (que confirma)
 *   Escape → reverte para o valor externo e faz blur SEM confirmar
 *
 * O rascunho acompanha o valor externo (broadcast do realtime) por
 * `useExternalDraft`, que segura a sincronização enquanto o campo está em
 * foco — digitação em andamento não é atropelada por edição alheia.
 */
export const TextCellEditor = memo(function TextCellEditor({
  column,
  value,
  onCommit,
  hasError,
}: CellEditorProps) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value)
  const field = useExternalDraft(text)

  const commit = () => {
    // `settle()` false = o usuário não editou (e o rascunho já se realinhou ao
    // valor externo). Commitar aqui reverteria a edição de outra pessoa.
    if (!field.settle()) return
    const next = field.draft.trim()
    if (next === text) return
    onCommit(next === '' ? null : next)
  }

  return (
    <TextField
      aria-label={column.title}
      aria-invalid={hasError || undefined}
      surface="plain"
      size="sm"
      className="w-full"
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
