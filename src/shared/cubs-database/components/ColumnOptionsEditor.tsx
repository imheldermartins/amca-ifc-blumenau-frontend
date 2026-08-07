import { Icon } from '@iconify/react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColorPicker, TextField, cn, type OptionColor } from 'cubs-components'

import type { ColumnOption } from '../types'
import { ulid } from '../utils'
import { useSortableSensors } from './dndSensors'
import { useExternalDraft } from './cells/useExternalDraft'

export interface ColumnOptionsEditorLabels {
  addOption?: string
  deleteOption?: string
  dragOption?: string
  optionColor?: string
  optionNamePlaceholder?: string
}

/**
 * Uma linha do editor: handle de drag + ColorPicker + nome (inline, commit no
 * blur via `useExternalDraft` — o painel pode estar aberto quando outra pessoa
 * edita) + excluir.
 */
function OptionRow({
  option,
  labels,
  onRename,
  onColor,
  onDelete,
}: {
  option: ColumnOption
  labels?: ColumnOptionsEditorLabels
  onRename: (label: string) => void
  onColor: (color: OptionColor) => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
  })
  const name = useExternalDraft(option.label)

  const commit = () => {
    if (!name.settle()) return
    const next = name.draft.trim()
    if (next !== option.label) onRename(next)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-1', isDragging && 'relative z-10 opacity-80')}
    >
      <button
        type="button"
        aria-label={labels?.dragOption ?? 'Arrastar opção'}
        {...attributes}
        {...listeners}
        className="cursor-grab rounded px-0.5 py-1 opacity-60 transition-colors hover:bg-active hover:opacity-100"
      >
        <Icon icon="lucide:grip-vertical" fontSize={14} />
      </button>
      <ColorPicker value={option.color} onPick={onColor} label={labels?.optionColor ?? 'Cor'} />
      <TextField
        aria-label={labels?.optionNamePlaceholder ?? 'Nome da opção'}
        surface="background"
        size="sm"
        className="min-w-0 flex-1"
        value={name.draft}
        onFocus={name.focus}
        onChange={(event) => name.change(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            event.stopPropagation()
            name.revert()
            event.currentTarget.blur()
          }
        }}
      />
      <button
        type="button"
        aria-label={labels?.deleteOption ?? 'Excluir opção'}
        onClick={onDelete}
        className="shrink-0 rounded p-1 text-p-red opacity-70 transition-opacity hover:opacity-100"
      >
        <Icon icon="lucide:trash-2" fontSize={14} />
      </button>
    </div>
  )
}

export interface ColumnOptionsEditorProps {
  options: ColumnOption[]
  /** Array COMPLETO na nova ordem/estado — read-modify-write, como o snapshot. */
  onChange: (options: ColumnOption[]) => void
  labels?: ColumnOptionsEditorLabels
}

/**
 * CRUD das options de uma coluna `select`, dentro do submenu "Opções" do menu
 * de coluna. Toda mudança (adicionar/renomear/cor/reordenar/excluir) sobe o
 * array COMPLETO por `onChange` — o mesmo contrato do `onColumnOptionsChange`.
 * Reusa o dnd-kit (sensores compartilhados) e o `ColorPicker` do pacote.
 */
export function ColumnOptionsEditor({ options, onChange, labels }: ColumnOptionsEditorProps) {
  const sensors = useSortableSensors()

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = options.findIndex((option) => option.id === active.id)
    const to = options.findIndex((option) => option.id === over.id)
    if (from < 0 || to < 0) return
    onChange(arrayMove(options, from, to))
  }

  return (
    <div className="flex min-w-64 flex-col gap-1">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={options.map((option) => option.id)}
          strategy={verticalListSortingStrategy}
        >
          {options.map((option) => (
            <OptionRow
              key={option.id}
              option={option}
              labels={labels}
              onRename={(label) =>
                onChange(options.map((o) => (o.id === option.id ? { ...o, label } : o)))
              }
              onColor={(color) =>
                onChange(options.map((o) => (o.id === option.id ? { ...o, color } : o)))
              }
              onDelete={() => onChange(options.filter((o) => o.id !== option.id))}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => onChange([...options, { id: ulid(), label: '' }])}
        className="mt-0.5 flex items-center gap-1.5 rounded px-2 py-1.5 text-sm opacity-80 transition-colors hover:bg-active hover:opacity-100"
      >
        <Icon icon="lucide:plus" fontSize={14} className="shrink-0" />
        {labels?.addOption ?? 'Adicionar opção'}
      </button>
    </div>
  )
}
