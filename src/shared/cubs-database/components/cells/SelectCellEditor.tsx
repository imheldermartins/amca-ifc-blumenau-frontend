import { memo, useEffect, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { Popover, cn } from 'cubs-components'

import type { CellEditorProps, ColumnOption } from '../../types'
import { useSortableSensors } from '../dndSensors'
import { OptionChip } from './OptionChip'

/** Referência ESTÁVEL para coluna sem options — `?? []` inline criaria um
    array novo por render e o efeito de sync dispararia à toa. */
const NO_OPTIONS: ColumnOption[] = []

/**
 * Uma option na lista do Popover: drag handle (só ele arrasta — o clique na
 * option continua sendo clique) + a option em si, que ao ser clicada vira o
 * valor da célula.
 */
function SortableOption({
  option,
  selected,
  dragLabel,
  onPick,
}: {
  option: ColumnOption
  selected: boolean
  dragLabel: string
  onPick: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-0.5 rounded', isDragging && 'relative z-10 opacity-80')}
    >
      <button
        type="button"
        aria-label={dragLabel}
        {...attributes}
        {...listeners}
        className="cursor-grab rounded px-0.5 py-1 opacity-60 transition-colors hover:bg-active hover:opacity-100"
      >
        <Icon icon="lucide:grip-vertical" fontSize={14} />
      </button>
      <button
        type="button"
        onClick={onPick}
        className="flex flex-1 items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-active"
      >
        <OptionChip option={option} />
        {selected && <Icon icon="lucide:check" fontSize={14} className="shrink-0 text-p-purple" />}
      </button>
    </div>
  )
}

/**
 * Editor de célula `select` — sintetiza o modelo do sistema: a célula guarda o
 * `id` da option (`{value:<option.id>}`) e as options moram na COLUNA. Duas
 * funções num componente só:
 *
 *  1. escolher: clique numa option → `onCommit(option.id)` e o Popover fecha
 *     (clicar na já selecionada só fecha, sem eco);
 *  2. ordenar: drag pelo handle (dnd-kit) → `onOptionsChange` com o array
 *     COMPLETO na nova ordem — read-modify-write, como o snapshot das views.
 *
 * A ordem local é otimista: o drag reordena na hora e o estado re-sincroniza
 * quando as `options` da coluna mudarem por fora (persistência/realtime).
 */
export const SelectCellEditor = memo(function SelectCellEditor({
  column,
  value,
  onCommit,
  onOptionsChange,
  labels,
}: CellEditorProps) {
  const options = column.options ?? NO_OPTIONS
  const [open, setOpen] = useState(false)
  const [localOptions, setLocalOptions] = useState(options)

  useEffect(() => setLocalOptions(options), [options])

  const sensors = useSortableSensors()

  const current = options.find((option) => option.id === value)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = localOptions.findIndex((option) => option.id === active.id)
    const to = localOptions.findIndex((option) => option.id === over.id)
    if (from < 0 || to < 0) return
    const next = arrayMove(localOptions, from, to)
    setLocalOptions(next)
    onOptionsChange?.(next)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="min-w-44"
      trigger={
        <button
          type="button"
          aria-label={column.title}
          className="flex h-full w-full cursor-pointer items-center px-3 py-2 text-left"
        >
          {current ? <OptionChip option={current} /> : <span className="text-sm opacity-60">—</span>}
        </button>
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={localOptions.map((option) => option.id)}
          strategy={verticalListSortingStrategy}
        >
          {localOptions.map((option) => (
            <SortableOption
              key={option.id}
              option={option}
              selected={option.id === value}
              dragLabel={labels?.dragOption ?? 'Arrastar option'}
              onPick={() => {
                if (option.id !== value) onCommit(option.id)
                setOpen(false)
              }}
            />
          ))}
        </SortableContext>
      </DndContext>
    </Popover>
  )
})
