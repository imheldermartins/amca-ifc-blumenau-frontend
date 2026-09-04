import { useMemo, useState } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { Button, Checkbox, Popover, TextField, Tooltip, cn } from 'cubs-components'

import { reorderPriorityValues } from '../prioritySelect'
import { useSortableSensors } from './dndSensors'

export interface PrioritySelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface PrioritySelectLabels {
  trigger: string
  search: string
  empty: string
  drag: string
  select: string
  priority: string
  clear?: string
}

export interface PrioritySelectProps {
  options: PrioritySelectOption[]
  /** Valores marcados, na ordem de prioridade. */
  value: string[]
  onValueChange: (value: string[]) => void
  labels: PrioritySelectLabels
  icon?: string
  disabled?: boolean
  className?: string
}

interface PriorityOptionRowProps {
  option: PrioritySelectOption
  checked: boolean
  priority: number | null
  dragDisabled: boolean
  labels: PrioritySelectLabels
  onCheckedChange: (checked: boolean) => void
}

function PriorityOptionRow({
  option,
  checked,
  priority,
  dragDisabled,
  labels,
  onCheckedChange,
}: PriorityOptionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.value, disabled: dragDisabled })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex min-h-9 min-w-0 items-center gap-2 rounded px-1.5 py-1 text-sm transition-colors hover:bg-active',
        checked && 'bg-p-purple-500/10',
        option.disabled && 'pointer-events-none opacity-50',
        isDragging && 'relative z-10 opacity-80 shadow-lg',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        aria-label={`${labels.drag}: ${option.label}`}
        disabled={dragDisabled}
        {...attributes}
        {...listeners}
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded text-dark-100 dark:text-light-900',
          checked && !dragDisabled
            ? 'cursor-grab hover:bg-active hover:text-foreground'
            : 'cursor-default opacity-25',
        )}
      >
        <Icon icon="lucide:grip-vertical" fontSize={15} />
      </button>

      <Checkbox
        checked={checked}
        disabled={option.disabled}
        aria-label={`${labels.select}: ${option.label}`}
        onCheckedChange={onCheckedChange}
      />

      <Tooltip content={option.label} side="right">
        <span
          className={cn(
            'min-w-0 flex-1 truncate whitespace-nowrap',
            option.label.length > 24 && 'text-xs',
          )}
        >
          {option.label}
        </span>
      </Tooltip>
      {priority !== null && (
        <span
          className="shrink-0 rounded-full bg-p-purple-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-p-purple"
          aria-label={`${labels.priority}: ${priority + 1}`}
        >
          {priority + 1}
        </span>
      )}
    </li>
  )
}

/**
 * Select múltiplo pesquisável em que a ordem dos itens marcados representa
 * prioridade. O handle vem antes do checkbox, e o drag fica desabilitado
 * durante a busca para não reordenar silenciosamente uma lista parcial.
 */
export function PrioritySelect({
  options,
  value,
  onValueChange,
  labels,
  icon = 'lucide:list-filter',
  disabled,
  className,
}: PrioritySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const sensors = useSortableSensors()
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  )
  const selected = useMemo(
    () =>
      value
        .map((id) => optionByValue.get(id))
        .filter((option): option is PrioritySelectOption => Boolean(option)),
    [optionByValue, value],
  )
  const selectedSet = useMemo(() => new Set(value), [value])
  const orderedOptions = useMemo(
    () => [...selected, ...options.filter((option) => !selectedSet.has(option.value))],
    [options, selected, selectedSet],
  )
  const visibleOptions = useMemo(
    () =>
      normalizedSearch
        ? orderedOptions.filter((option) =>
            option.label.toLocaleLowerCase().includes(normalizedSearch),
          )
        : orderedOptions,
    [normalizedSearch, orderedOptions],
  )
  const visibleSelectedIds = visibleOptions
    .filter((option) => selectedSet.has(option.value))
    .map((option) => option.value)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (normalizedSearch || !over || active.id === over.id) return
    const next = reorderPriorityValues(value, String(active.id), String(over.id))
    if (next !== value) onValueChange(next)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setSearch('')
  }

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      className="w-80 p-2"
      trigger={
        <Button
          variant="outlined"
          color="from-theme"
          disabled={disabled}
          aria-label={labels.trigger}
          aria-expanded={open}
          className={cn('h-8 gap-1.5 px-2 font-normal', className)}
        >
          <Icon icon={icon} fontSize={17} />
          <span>{labels.trigger}</span>
          {value.length > 0 && (
            <span className="rounded-full bg-p-purple-500/15 px-1.5 text-xs font-semibold text-p-purple">
              {value.length}
            </span>
          )}
          <Icon icon="lucide:chevron-down" fontSize={14} className="opacity-60" />
        </Button>
      }
    >
      <TextField
        type="search"
        size="sm"
        surface="background"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={labels.search}
        placeholder={labels.search}
        startAdornment={<Icon icon="lucide:search" fontSize={14} />}
      />

      <div className="mt-2 max-h-72 overflow-y-auto">
        {visibleOptions.length === 0 ? (
          <p className="px-2 py-5 text-center text-sm text-dark-100 dark:text-light-900">
            {labels.empty}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visibleSelectedIds} strategy={verticalListSortingStrategy}>
              <ul role="list" className="m-0 list-none p-0">
                {visibleOptions.map((option) => {
                  const priority = value.indexOf(option.value)
                  const checked = priority >= 0
                  return (
                    <PriorityOptionRow
                      key={option.value}
                      option={option}
                      checked={checked}
                      priority={checked ? priority : null}
                      dragDisabled={!checked || Boolean(normalizedSearch)}
                      labels={labels}
                      onCheckedChange={(next) =>
                        onValueChange(
                          next
                            ? [...value, option.value]
                            : value.filter((candidate) => candidate !== option.value),
                        )
                      }
                    />
                  )
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
      <div className="mt-2 flex justify-end border-t border-divider pt-2">
        <Button
          variant="text"
          color="from-theme"
          disabled={value.length === 0}
          onClick={() => {
            onValueChange([])
            handleOpenChange(false)
          }}
        >
          {labels.clear ?? 'Limpar agrupamento'}
        </Button>
      </div>
    </Popover>
  )
}
