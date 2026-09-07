import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Icon } from '@iconify/react'
import { ContextMenu, cn, type ContextMenuItem } from 'cubs-components'

import type { DataViewSettings } from '../types'
import { VIEW_KIND_ICON } from '../viewKinds'

export interface ViewTabsBarProps {
  settings: DataViewSettings
  activeViewId: string
  onViewChange: (viewId: string) => void
  /** Itens do ContextMenu da tab (aberto SOMENTE com botão direito). */
  viewMenuItems?: (viewId: string) => ContextMenuItem[]
}

/**
 * Topbar de views: uma tab por chave de `settings` (sem close por enquanto).
 * O scroll é SÓ horizontal (vertical hidden). Clique esquerdo ativa a view;
 * botão direito abre o ContextMenu da tab (segurar/arrastar fica para o
 * drag-and-drop futuro).
 */
export function ViewTabsBar({ settings, activeViewId, onViewChange, viewMenuItems }: ViewTabsBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ viewId: string; left: number } | null>(null)

  const handleTabContextMenu = (viewId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!viewMenuItems) return
    const barRect = barRef.current?.getBoundingClientRect()
    const tabRect = event.currentTarget.getBoundingClientRect()
    const left = barRect ? tabRect.left - barRect.left : 0
    setMenu({ viewId, left })
  }

  return (
    <div ref={barRef} className="relative">
      <div
        className="flex items-center gap-1 overflow-x-auto overflow-y-hidden pb-1"
        onScroll={() => setMenu(null)}
      >
        {Object.entries(settings).map(([viewId, view]) => {
          const active = viewId === activeViewId
          return (
            <button
              key={viewId}
              type="button"
              data-state={active ? 'active' : 'inactive'}
              onClick={() => {
                setMenu(null)
                if (!active) onViewChange(viewId)
              }}
              onContextMenu={(event) => handleTabContextMenu(viewId, event)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-sm transition-[color,background-color,border-color,box-shadow]',
                active
                  ? 'border-divider-contrast bg-active text-foreground shadow-sm'
                  : 'border-divider bg-transparent opacity-60 hover:border-divider-contrast hover:bg-contrast hover:opacity-100',
              )}
            >
              <Icon
                icon={VIEW_KIND_ICON[view.view]}
                fontSize={15}
                className={cn('shrink-0', active && 'text-p-purple')}
              />
              {view.name}
            </button>
          )
        })}
      </div>

      {menu ? (
        <ContextMenu
          open
          onClose={() => setMenu(null)}
          items={viewMenuItems?.(menu.viewId) ?? []}
          className="top-full"
          style={{ left: menu.left }}
        />
      ) : null}
    </div>
  )
}
