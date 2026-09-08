import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Menu, TextField, cn } from 'cubs-components'

import type {
  ColumnConfigPatch,
  ColumnDataType,
  ColumnOption,
  HeaderCol,
} from '../types'
import {
  buildColumnHeaderMenuNodes,
  type ColumnHeaderMenuLabels,
} from './columnHeaderMenu.shared'
import { useExternalDraft } from './cells/useExternalDraft'

export type { ColumnHeaderMenuLabels } from './columnHeaderMenu.shared'

export interface ColumnHeaderMenuProps {
  column: HeaderCol
  /** Tipo RESOLVIDO da coluna (o mesmo do ícone do header). */
  columnType: ColumnDataType
  onClose: () => void
  /** Cada callback presente habilita a seção correspondente. */
  onRename?: (name: string) => void
  onColumnTypeChange?: (type: ColumnDataType) => void
  onColumnOptionsChange?: (options: ColumnOption[]) => void
  onColumnConfigChange?: (patch: ColumnConfigPatch) => void
  /** A coluna tem células divergentes do tipo atual → habilita o "reset". */
  diverging?: boolean
  /** Executa o "reset de tipos" (destrutivo). Aparece só com `diverging`. */
  onColumnReset?: () => void
  /** Envia a coluna real para a lixeira após confirmação inline. */
  onColumnDelete?: () => void
  labels?: ColumnHeaderMenuLabels
  /** Posicionamento fica com o caller (painel é `absolute`; pai `relative`). */
  className?: string
  style?: CSSProperties
}

/** Campo de renomear — rascunho realtime-safe (o menu pode estar aberto quando
    outra pessoa renomeia). Commit no blur, só se mudou. */
function RenameField({
  column,
  label,
  onRename,
  onClose,
  onPendingBlurChange,
}: {
  column: HeaderCol
  label: string
  onRename: (name: string) => void
  onClose: () => void
  /** true enquanto há um rename editado esperando o commit do blur. */
  onPendingBlurChange: (pending: boolean) => void
}) {
  const field = useExternalDraft(column.title)

  const commit = () => {
    onPendingBlurChange(false)
    if (!field.settle()) return
    const next = field.draft.trim()
    if (next !== '' && next !== column.title) onRename(next)
    onClose()
  }

  return (
    <TextField
      aria-label={label}
      surface="background"
      size="sm"
      value={field.draft}
      onFocus={field.focus}
      onChange={(event) => {
        field.change(event.target.value)
        onPendingBlurChange(true)
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          event.stopPropagation()
          onPendingBlurChange(false)
          field.revert()
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/**
 * Menu da coluna (botão DIREITO no header). Monta um `Menu` com as seções
 * habilitadas pela presença dos callbacks: renomear (campo inline), trocar
 * TIPO, e a config do tipo ATUAL — options (select), formato/moeda (numeric),
 * máscara (text). Cada write sobe pelo callback; a lib não conhece transporte.
 *
 * O painel é `absolute` (posicionado pelo caller); os SUBMENUS são Popovers do
 * `Menu` (portalados). Por isso o fechar-ao-clicar-fora IGNORA cliques
 * dentro de qualquer popper do Radix — senão clicar num submenu fecharia tudo.
 */
export function ColumnHeaderMenu({
  column,
  columnType,
  onClose,
  onRename,
  onColumnTypeChange,
  onColumnOptionsChange,
  onColumnConfigChange,
  diverging,
  onColumnReset,
  onColumnDelete,
  labels,
  className,
  style,
}: ColumnHeaderMenuProps) {
  const pendingRenameBlurRef = useRef(false)
  const handlePendingBlurChange = useCallback((pending: boolean) => {
    pendingRenameBlurRef.current = pending
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      // Clique dentro de um submenu (Popover portalado do NestedMenu) não fecha.
      if ((event.target as Element)?.closest?.('[data-radix-popper-content-wrapper]')) return
      // `pointerdown` vem antes de `blur`. Se um rename editado está esperando
      // o blur, fechar aqui desmontaria o input e apagaria o commit pendente.
      // Consome UMA tentativa de fechamento; o clique segue normalmente,
      // provoca o blur e o próprio commit fecha o menu em seguida.
      if (pendingRenameBlurRef.current) {
        pendingRenameBlurRef.current = false
        return
      }
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const nodes = buildColumnHeaderMenuNodes({
    column,
    columnType,
    onClose,
    onRename,
    renderRenameContent: (rename) => (
      <RenameField
        column={column}
        label={labels?.renameColumn ?? 'Renomear coluna'}
        onRename={rename}
        onClose={onClose}
        onPendingBlurChange={handlePendingBlurChange}
      />
    ),
    onColumnTypeChange,
    onColumnOptionsChange,
    onColumnConfigChange,
    diverging,
    onColumnReset,
    onColumnDelete,
    labels,
  })

  return (
    <Menu
      items={nodes}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className={cn('absolute z-50 mt-1 min-w-48', className)}
    />
  )
}
