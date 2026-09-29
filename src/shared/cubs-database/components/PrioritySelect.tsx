import { useMemo, useRef, useState } from 'react'
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
  /** Mantém todas as opções marcadas e usa o controle somente para ordenação. */
  allowSelection?: boolean
  /** Mantém as edições locais e emite uma única alteração ao fechar o popover. */
  commitOnClose?: boolean
  /** Renderiza a lista diretamente no layout, sem uma segunda camada de popover. */
  inline?: boolean
  className?: string
}

interface PriorityOptionRowProps {
  option: PrioritySelectOption
  checked: boolean
  priority: number | null
  dragDisabled: boolean
  selectionDisabled: boolean
  labels: PrioritySelectLabels
  onCheckedChange: (checked: boolean) => void
}

function PriorityOptionRow({
  option,
  checked,
  priority,
  dragDisabled,
  selectionDisabled,
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
        'flex min-h-9 min-w-0 items-center gap-3 rounded px-2 py-1.5 text-sm transition-colors hover:bg-active',
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

      {!selectionDisabled ? <Checkbox
        checked={checked}
        disabled={option.disabled}
        aria-label={`${labels.select}: ${option.label}`}
        onCheckedChange={onCheckedChange}
      /> : null}

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
  allowSelection = true,
  commitOnClose = false,
  inline = false,
  className,
}: PrioritySelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draftValue, setDraftValue] = useState(value)
  const draftValueRef = useRef(value)
  const sensors = useSortableSensors()
  const activeValue = commitOnClose && open ? draftValue : value
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const optionByValue = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  )
  const selected = useMemo(
    () =>
      activeValue
        .map((id) => optionByValue.get(id))
        .filter((option): option is PrioritySelectOption => Boolean(option)),
    [activeValue, optionByValue],
  )
  const selectedSet = useMemo(() => new Set(activeValue), [activeValue])
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
    const next = reorderPriorityValues(activeValue, String(active.id), String(over.id))
    if (next !== activeValue) changeValue(next)
  }

  const handleOpenChange = (next: boolean) => {
    if (next && commitOnClose) {
      const initial = [...value]
      draftValueRef.current = initial
      setDraftValue(initial)
    }
    if (!next && commitOnClose && JSON.stringify(draftValueRef.current) !== JSON.stringify(value)) {
      onValueChange([...draftValueRef.current])
    }
    setOpen(next)
    if (!next) setSearch('')
  }

  const changeValue = (next: string[]) => {
    if (commitOnClose) {
      draftValueRef.current = next
      setDraftValue(next)
      return
    }
    onValueChange(next)
  }

  const panel = <>
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
              <ul role="list" className="m-0 grid list-none gap-1.5 p-0">
                {visibleOptions.map((option) => {
                  const priority = activeValue.indexOf(option.value)
                  const checked = priority >= 0
                  const rowOption = disabled ? { ...option, disabled: true } : option
                  return (
                    <PriorityOptionRow
                      key={option.value}
                      option={rowOption}
                      checked={checked}
                      priority={checked ? priority : null}
                      dragDisabled={!checked || Boolean(normalizedSearch)}
                      selectionDisabled={!allowSelection}
                      labels={labels}
                      onCheckedChange={(next) => {
                        if (!allowSelection) return
                        changeValue(next ? [...activeValue, option.value] : activeValue.filter((candidate) => candidate !== option.value))
                      }}
                    />
                  )
                })}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
      {allowSelection ? <div className="mt-2 flex justify-end border-t border-divider pt-2">
        <Button
          variant="text"
          color="from-theme"
          disabled={activeValue.length === 0}
          onClick={() => {
            if (inline) {
              onValueChange([])
              return
            }
            if (commitOnClose) {
              draftValueRef.current = []
              setDraftValue([])
            } else {
              onValueChange([])
            }
            handleOpenChange(false)
          }}
        >
          {labels.clear ?? 'Limpar agrupamento'}
        </Button>
      </div> : null}
    </>

  if (inline) {
    return <section aria-label={labels.trigger} aria-disabled={disabled} className={cn('rounded-lg border border-divider p-2', disabled && 'opacity-50', className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1 text-sm font-medium">
        <span>{labels.trigger}</span>
        <span className="rounded-full bg-p-purple-500/15 px-1.5 text-xs font-semibold text-p-purple">{activeValue.length}</span>
      </div>
      {panel}
    </section>
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
          {activeValue.length > 0 && (
            <span className="rounded-full bg-p-purple-500/15 px-1.5 text-xs font-semibold text-p-purple">
              {activeValue.length}
            </span>
          )}
          <Icon icon="lucide:chevron-down" fontSize={14} className="opacity-60" />
        </Button>
      }
    >
      {panel}
    </Popover>
  )
}
