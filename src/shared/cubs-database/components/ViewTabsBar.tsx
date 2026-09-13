import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Icon } from '@iconify/react'
import { ContextMenu, cn, type ContextMenuItem } from 'cubs-components'

import type { DataViewKind, DataViewSettings } from '../types'
import { DATA_VIEW_KINDS, VIEW_KIND_ICON } from '../viewKinds'

export interface ViewTabsBarProps {
  settings: DataViewSettings
  activeViewId: string
  onViewChange: (viewId: string) => void
  onAddView?: (kind: DataViewKind) => void | Promise<void>
  addViewLabel?: string
  viewTypeLabels?: Record<DataViewKind, string>
  /** Itens do ContextMenu da tab (aberto SOMENTE com botão direito). */
  viewMenuItems?: (viewId: string, actions: { startRename: () => void }) => ContextMenuItem[]
  onRenameView?: (viewId: string, name: string) => void | Promise<void>
}

/**
 * Topbar de views: uma tab por chave de `settings` (sem close por enquanto).
 * O scroll é SÓ horizontal (vertical hidden). Clique esquerdo ativa a view;
 * botão direito abre o ContextMenu da tab (segurar/arrastar fica para o
 * drag-and-drop futuro).
 */
export function ViewTabsBar({ settings, activeViewId, onViewChange, onAddView, addViewLabel = 'Adicionar view', viewTypeLabels, viewMenuItems, onRenameView }: ViewTabsBarProps) {
  const barRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState<{ viewId?: string; left: number } | null>(null)
  const [adding, setAdding] = useState(false)
  const [renaming, setRenaming] = useState<{ viewId: string; name: string } | null>(null)

  const commitRename = () => {
    if (!renaming) return
    const name = renaming.name.trim()
    setRenaming(null)
    if (name && name !== settings[renaming.viewId]?.name) {
      void onRenameView?.(renaming.viewId, name)
    }
  }

  const handleTabContextMenu = (viewId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!viewMenuItems) return
    const barRect = barRef.current?.getBoundingClientRect()
    const tabRect = event.currentTarget.getBoundingClientRect()
    const left = barRect ? tabRect.left - barRect.left : 0
    setMenu({ viewId, left })
  }

  const handleAddView = async (kind: DataViewKind) => {
    if (!onAddView || adding) return
    setAdding(true)
    try {
      await onAddView(kind)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div ref={barRef} className="relative">
      <div
        className="flex items-center gap-1 overflow-x-auto overflow-y-hidden pb-1"
        onScroll={() => setMenu(null)}
      >
        {Object.entries(settings).map(([viewId, view]) => {
          const active = viewId === activeViewId
          const tabClass = cn(
            'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-sm transition-[color,background-color,border-color,box-shadow]',
            active
              ? 'border-divider-contrast bg-active text-foreground shadow-sm'
              : 'border-divider bg-transparent opacity-60 hover:border-divider-contrast hover:bg-contrast hover:opacity-100',
          )
          if (renaming?.viewId === viewId) {
            return (
              <div key={viewId} className={tabClass}>
                <Icon icon={VIEW_KIND_ICON[view.view]} fontSize={15} className="shrink-0" />
                <input
                  aria-label={view.name}
                  ref={(node) => { if (node && document.activeElement !== node) { node.focus(); node.select() } }}
                  value={renaming.name}
                  maxLength={120}
                  onChange={(event) => setRenaming({ viewId, name: event.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    event.stopPropagation()
                    if (event.key === 'Enter') commitRename()
                    if (event.key === 'Escape') setRenaming(null)
                  }}
                  className="min-w-20 max-w-48 bg-transparent outline-none"
                />
              </div>
            )
          }
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
              className={tabClass}
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
        {onAddView ? (
          <button
            type="button"
            aria-label={addViewLabel}
            aria-haspopup="menu"
            aria-expanded={menu?.viewId === undefined && menu !== null}
            disabled={adding}
            onClick={(event) => {
              const barRect = barRef.current?.getBoundingClientRect()
              const buttonRect = event.currentTarget.getBoundingClientRect()
              const left = barRect ? buttonRect.left - barRect.left : 0
              setMenu((current) => current && current.viewId === undefined ? null : { left })
            }}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground opacity-60 transition-colors hover:bg-contrast hover:opacity-100 focus-visible:outline-2 focus-visible:outline-p-purple disabled:opacity-40"
          >
            <Icon aria-hidden="true" icon="lucide:circle-plus" fontSize={19} />
          </button>
        ) : null}
      </div>

      {menu ? (
        <ContextMenu
          open
          onClose={() => setMenu(null)}
          items={menu.viewId
            ? viewMenuItems?.(menu.viewId, {
                startRename: () => {
                  const view = settings[menu.viewId!]
                  if (view && onRenameView) setRenaming({ viewId: menu.viewId!, name: view.name })
                },
              }) ?? []
            : DATA_VIEW_KINDS.map((kind) => ({
                id: kind,
                label: viewTypeLabels?.[kind] ?? kind,
                icon: VIEW_KIND_ICON[kind],
                onSelect: () => { void handleAddView(kind) },
              }))}
          className="top-full"
          style={{ left: menu.left }}
        />
      ) : null}
    </div>
  )
}
