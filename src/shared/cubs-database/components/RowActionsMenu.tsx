import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NestedMenu, Popover, type MenuNode } from 'cubs-components'

export interface RowActionsMenuLabels {
  rowActions?: string
  selectRowAction?: string
  moveUp?: string
  moveDown?: string
  moveToTrash?: string
  confirmMoveToTrash?: string
}

export interface RowActionsMenuProps {
  /** A própria alça de drag; o Popover injeta nela a mecânica de trigger. */
  trigger: ReactNode
  /** Fecha o painel caso um pointerdown no próprio trigger tenha virado drag. */
  dragging?: boolean
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDelete?: () => void
  labels?: RowActionsMenuLabels
}

/** Dropdown de ações de uma página/linha, incluindo confirmação destrutiva inline. */
export function RowActionsMenu({
  trigger,
  dragging = false,
  selected,
  canMoveUp,
  canMoveDown,
  onSelect,
  onMoveUp,
  onMoveDown,
  onDelete,
  labels,
}: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (dragging) setOpen(false)
  }, [dragging])

  const selectAndClose = (action?: () => void) => () => {
    action?.()
    setOpen(false)
  }
  const items: MenuNode[] = [
    {
      id: 'select',
      name: labels?.selectRowAction ?? 'Selecionar',
      icon: selected ? 'lucide:square-check-big' : 'lucide:square',
      onSelect: selectAndClose(onSelect),
    },
    {
      id: 'move-up',
      name: labels?.moveUp ?? 'Mover para cima',
      icon: 'lucide:arrow-up',
      disabled: !canMoveUp || !onMoveUp,
      onSelect: selectAndClose(onMoveUp),
    },
    {
      id: 'move-down',
      name: labels?.moveDown ?? 'Mover para baixo',
      icon: 'lucide:arrow-down',
      disabled: !canMoveDown || !onMoveDown,
      onSelect: selectAndClose(onMoveDown),
    },
    {
      id: 'move-to-trash',
      name: labels?.moveToTrash ?? 'Mover para lixeira',
      icon: 'lucide:trash-2',
      separatorBefore: true,
      danger: true,
      disabled: !onDelete,
      confirm: {
        icon: 'lucide:triangle-alert',
        label: labels?.confirmMoveToTrash ?? 'Confirmar mover para lixeira',
      },
      onSelect: selectAndClose(onDelete),
    },
  ]

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      side="bottom"
      align="start"
      sideOffset={4}
      trigger={trigger}
    >
      <NestedMenu nodes={items} />
    </Popover>
  )
}
