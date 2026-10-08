import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties, RefObject } from 'react'
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
  onFlowConfigure?: () => void
  /** Envia a coluna real para a lixeira após confirmação inline. */
  onColumnDelete?: () => void
  labels?: ColumnHeaderMenuLabels
  /** Posicionamento fica com o caller (painel é `absolute`; pai `relative`). */
  className?: string
  style?: CSSProperties
}

function isColumnMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('[data-column-header-menu], [data-radix-popper-content-wrapper]'),
  )
}

/** Campo de renomear — rascunho realtime-safe (o menu pode estar aberto quando
    outra pessoa renomeia). Commit no blur, só se mudou. */
function RenameField({
  column,
  label,
  onRename,
  onClose,
  onPendingBlurChange,
  onFocusChange,
  commitRef,
}: {
  column: HeaderCol
  label: string
  onRename: (name: string) => void
  onClose: () => void
  /** true enquanto há um rename editado esperando o commit do blur. */
  onPendingBlurChange: (pending: boolean) => void
  onFocusChange: (focused: boolean) => void
  /** Permite que uma ação que fecha o menu confirme o rename antes de desmontá-lo. */
  commitRef: RefObject<(() => void) | null>
}) {
  const field = useExternalDraft(column.title)

  const commit = (close: boolean) => {
    onPendingBlurChange(false)
    if (field.settle()) {
      const next = field.draft.trim()
      if (next !== '' && next !== column.title) onRename(next)
    }
    if (close) onClose()
  }
  commitRef.current = () => commit(false)

  return (
    <TextField
      aria-label={label}
      surface="background"
      size="sm"
      value={field.draft}
      onFocus={() => {
        field.focus()
        onFocusChange(true)
      }}
      onChange={(event) => {
        field.change(event.target.value)
        onPendingBlurChange(true)
      }}
      onBlur={(event) => {
        onFocusChange(false)
        // Campos dos submenus portalados podem receber foco sem desmontar o
        // menu. O rename é confirmado, mas o fechamento fica para o clique
        // realmente externo (ou para uma ação que explicitamente o fecha).
        commit(!isColumnMenuTarget(event.relatedTarget))
      }}
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
  onFlowConfigure,
  onColumnDelete,
  labels,
  className,
  style,
}: ColumnHeaderMenuProps) {
  const pendingRenameBlurRef = useRef(false)
  const renameFocusedRef = useRef(false)
  const renameCommitRef = useRef<(() => void) | null>(null)
  const handlePendingBlurChange = useCallback((pending: boolean) => {
    pendingRenameBlurRef.current = pending
  }, [])
  const handleClose = useCallback(() => {
    if (pendingRenameBlurRef.current) renameCommitRef.current?.()
    onClose()
  }, [onClose])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      // Um submenu do NestedMenu é portalado. Enquanto o rename está focado,
      // pointerdown numa ação do próprio popover não transfere foco: isso
      // dispararia o blur e fecharia o menu antes do click da ação.
      const target = event.target as Element | null
      if (target?.closest?.('[data-radix-popper-content-wrapper]')) {
        if (
          renameFocusedRef.current &&
          !target.closest('input, textarea, select, [contenteditable="true"]')
        ) {
          event.preventDefault()
        }
        return
      }
      // `pointerdown` vem antes de `blur`. Se um rename editado está esperando
      // o blur, fechar aqui desmontaria o input e apagaria o commit pendente.
      // Consome UMA tentativa de fechamento; o clique segue normalmente,
      // provoca o blur e o próprio commit fecha o menu em seguida.
      if (pendingRenameBlurRef.current) {
        pendingRenameBlurRef.current = false
        return
      }
      handleClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleClose])

  const nodes = buildColumnHeaderMenuNodes({
    column,
    columnType,
    onClose: handleClose,
    onRename,
    renderRenameContent: (rename) => (
      <RenameField
        column={column}
        label={labels?.renameColumn ?? 'Renomear coluna'}
        onRename={rename}
        onClose={handleClose}
        onPendingBlurChange={handlePendingBlurChange}
        onFocusChange={(focused) => {
          renameFocusedRef.current = focused
        }}
        commitRef={renameCommitRef}
      />
    ),
    onColumnTypeChange,
    onColumnOptionsChange,
    onColumnConfigChange,
    onFlowConfigure,
    onColumnDelete,
    labels,
  })

  return (
    <Menu
      items={nodes}
      data-column-header-menu
      style={style}
      onPointerDown={(event) => {
        event.stopPropagation()
        const target = event.target as Element
        if (
          renameFocusedRef.current &&
          !target.closest('input, textarea, select, [contenteditable="true"]')
        ) {
          event.preventDefault()
        }
      }}
      onContextMenu={(event) => event.preventDefault()}
      className={cn('absolute z-50 mt-1 min-w-48', className)}
    />
  )
}
