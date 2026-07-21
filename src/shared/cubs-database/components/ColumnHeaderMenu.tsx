import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '@iconify/react'
import { TextField, cn } from 'cubs-components'

import type { ColumnDataType, HeaderCol } from '../types'

export interface ColumnHeaderMenuLabels {
  /** Rótulo do campo de renomear (aria-label; sem label visível). */
  renameColumn?: string
  /** Rótulos exibíveis por tipo de coluna; ausente = o token cru. */
  columnTypes?: Partial<Record<ColumnDataType, string>>
}

export interface ColumnHeaderMenuProps {
  column: HeaderCol
  /** Tipo RESOLVIDO da coluna (o mesmo do ícone do header). */
  columnType: ColumnDataType
  /** Ícone do tipo — vem do mesmo mapa do header (`TYPE_ICON`). */
  typeIcon: string
  onClose: () => void
  /** Presente = renomear habilitado; commit no blur/Enter, só se mudou. */
  onRename?: (name: string) => void
  labels?: ColumnHeaderMenuLabels
  /** Posicionamento fica com o caller (painel é `absolute`; pai `relative`). */
  className?: string
  style?: CSSProperties
}

/**
 * Menu da coluna (aberto com botão DIREITO no header, mesmo padrão do
 * ContextMenu das tabs de view): o TIPO da coluna como informação readonly e o
 * campo de renomear — que já fala o payload do futuro `column-renamed` do
 * realtime (`onRename(name)`; o `columnId` quem monta é o caller).
 *
 * Não usa o `ContextMenu` do pacote porque ele é items-only (botões); aqui o
 * conteúdo é composto (info + campo). A SUPERFÍCIE é a mesma de propósito —
 * glass, igual Popover/ContextMenu.
 */
export function ColumnHeaderMenu({
  column,
  columnType,
  typeIcon,
  onClose,
  onRename,
  labels,
  className,
  style,
}: ColumnHeaderMenuProps) {
  const [draft, setDraft] = useState(column.title)
  const skipCommitRef = useRef(false)

  // Clique fora / Escape fecham (padrão do ContextMenu). O pointerdown DENTRO
  // do painel não pode fechar — o stopPropagation no root cuida disso.
  useEffect(() => {
    const handlePointerDown = () => onClose()
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

  const commit = () => {
    if (skipCommitRef.current) {
      skipCommitRef.current = false
      return
    }
    const next = draft.trim()
    if (next === '' || next === column.title) return
    onRename?.(next)
    onClose()
  }

  return (
    <div
      role="menu"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'absolute z-50 mt-1 min-w-44 rounded-lg border border-divider-contrast p-1 shadow-xl',
        'bg-glass backdrop-blur-md',
        className,
      )}
    >
      {/* Tipo da coluna: informação readonly — o tipo não se edita por aqui. */}
      <div className="flex items-center gap-2 rounded px-2 py-1.5 text-sm opacity-60">
        <Icon icon={typeIcon} fontSize={15} className="shrink-0" />
        <span className="whitespace-nowrap">
          {labels?.columnTypes?.[columnType] ?? columnType}
        </span>
      </div>

      {onRename && (
        <div className="border-t border-divider-contrast p-1">
          <TextField
            aria-label={labels?.renameColumn ?? 'Renomear coluna'}
            surface="background"
            size="sm"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {
                // Primeiro Escape só reverte o campo; o stopPropagation impede
                // o listener do documento de fechar o menu junto.
                event.stopPropagation()
                skipCommitRef.current = true
                setDraft(column.title)
                event.currentTarget.blur()
              }
            }}
          />
        </div>
      )}
    </div>
  )
}
