import { useEffect } from 'react'
import type { CSSProperties } from 'react'

import { Menu } from './Menu'
import { cn } from './lib/utils'

/** Item do ContextMenu (aberto com botão DIREITO do mouse). */
export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  danger?: boolean
  onSelect?: () => void
}

export interface ContextMenuProps {
  open: boolean
  onClose: () => void
  items: ContextMenuItem[]
  /** Posicionamento fica com o caller (painel é `absolute`; pai `relative`). */
  className?: string
  style?: CSSProperties
}

/**
 * Menu contextual (o caller controla `open` — na CubsDatabase, aberto com botão
 * DIREITO na tab da view). Fundo "glass": mesmo tom do background com
 * transparência + backdrop blur. Fecha com clique fora ou Escape.
 */
export function ContextMenu({ open, onClose, items, className, style }: ContextMenuProps) {
  useEffect(() => {
    if (!open) return
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
  }, [open, onClose])

  if (!open) return null

  return (
    <Menu
      items={items.map((item) => ({
        id: item.id,
        name: item.label,
        icon: item.icon,
        danger: item.danger,
        onSelect: () => {
          item.onSelect?.()
          onClose()
        },
      }))}
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className={cn('absolute z-50 mt-1 min-w-44', className)}
    />
  )
}
