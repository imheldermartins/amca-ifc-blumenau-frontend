import { useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { NestedMenu, Popover } from 'cubs-components'

export interface BatchRowActionsMenuLabels {
  moveSelectedToTrash?: (count: number) => string
  confirmSelectedToTrash?: (count: number) => string
}

/** A mesma confirmação da lixeira individual, aplicada à seleção do header. */
export function BatchRowActionsMenu({
  rowIds,
  pending = false,
  onDelete,
  labels,
}: {
  rowIds: string[]
  pending?: boolean
  onDelete: (rowIds: string[]) => void
  labels?: BatchRowActionsMenuLabels
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (pending) setOpen(false)
  }, [pending])

  const count = rowIds.length
  const label = labels?.moveSelectedToTrash?.(count) ?? `Mover selecionadas para lixeira (${count})`
  return (
    <Popover
      open={open && !pending}
      onOpenChange={setOpen}
      side="bottom"
      align="start"
      sideOffset={4}
      trigger={
        <button
          type="button"
          disabled={pending || count === 0}
          aria-label={label}
          aria-busy={pending}
          title={label}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-p-red transition-colors hover:bg-p-red/10 focus-visible:bg-p-red/10 focus-visible:outline-none disabled:cursor-wait disabled:opacity-50"
        >
          <Icon icon={pending ? 'lucide:loader-circle' : 'lucide:trash-2'} fontSize={15} className={pending ? 'animate-spin' : undefined} />
          <span className="text-xs tabular-nums">{count}</span>
        </button>
      }
    >
      <NestedMenu
        // Uma seleção alterada precisa confirmar de novo, mesmo com a mesma quantidade.
        key={rowIds.join(',')}
        nodes={[{
          id: 'trash-selected',
          name: label,
          icon: 'lucide:trash-2',
          danger: true,
          confirm: {
            label: labels?.confirmSelectedToTrash?.(count) ?? `Confirmar envio para lixeira (${count})`,
          },
          onSelect: () => {
            if (pending || count === 0) return
            setOpen(false)
            onDelete([...rowIds])
          },
        }]}
      />
    </Popover>
  )
}
