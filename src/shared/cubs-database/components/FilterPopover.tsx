import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Icon } from '@iconify/react'
import { Button, Checkbox, Popover, Select, TextField } from 'cubs-components'

import type { ColumnDataType, HeaderCol } from '../types'
import {
  mappedFilters,
  type FilterCondition,
  type FilterValueInput,
  type ViewFilterClause,
} from '../viewFilters'

export interface FilterPopoverLabels {
  trigger: string
  where: string
  column: string
  condition: string
  value: string
  valueFrom: string
  valueTo: string
  selectedOption?: string
  selectedOptions?: string
  add: string
  clear?: string
  true: string
  false: string
  conditions: Record<FilterCondition, string>
}

interface ValueEditorProps {
  values: string[]
  onChange: (values: string[]) => void
  column: HeaderCol
  labels: FilterPopoverLabels
}

function SingleTextValue({ values, onChange, labels }: ValueEditorProps) {
  return (
    <TextField
      aria-label={labels.value}
      value={values[0] ?? ''}
      onChange={(event) => onChange([event.target.value])}
    />
  )
}

function NumericValue(props: ValueEditorProps) {
  const { values, onChange, labels } = props
  return (
    <TextField
      type="number"
      aria-label={labels.value}
      value={values[0] ?? ''}
      onChange={(event) => onChange([event.target.value])}
    />
  )
}

function toDateTimeLocal(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const twoDigits = (part: number) => String(part).padStart(2, '0')
  return [
    `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`,
    `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`,
  ].join('T')
}

function fromDateTimeLocal(value: string): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toISOString()
}

function DateValue({ values, onChange, labels }: ValueEditorProps) {
  return (
    <TextField
      type="datetime-local"
      aria-label={labels.value}
      value={toDateTimeLocal(values[0] ?? '')}
      onChange={(event) => onChange([fromDateTimeLocal(event.target.value)])}
    />
  )
}

function DateRangeValue({ values, onChange, labels }: ValueEditorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <TextField
        type="datetime-local"
        aria-label={labels.valueFrom}
        value={toDateTimeLocal(values[0] ?? '')}
        onChange={(event) => onChange([fromDateTimeLocal(event.target.value), values[1] ?? ''])}
      />
      <TextField
        type="datetime-local"
        aria-label={labels.valueTo}
        value={toDateTimeLocal(values[1] ?? '')}
        onChange={(event) => onChange([values[0] ?? '', fromDateTimeLocal(event.target.value)])}
      />
    </div>
  )
}

function SelectValue({ values, onChange, column, labels }: ValueEditorProps) {
  const [open, setOpen] = useState(false)
  const options = useMemo(() => column.options ?? [], [column.options])
  const validOptionIds = useMemo(() => new Set(options.map((option) => option.id)), [options])
  const selectedValues = values.filter((value) => validOptionIds.has(value))
  const selectedCountLabel =
    selectedValues.length === 0
      ? labels.value
      : `${selectedValues.length} ${
          selectedValues.length === 1
            ? (labels.selectedOption ?? 'opção selecionada')
            : (labels.selectedOptions ?? 'opções selecionadas')
        }`

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="w-[var(--radix-popover-trigger-width)] p-1"
      trigger={
        <Button
          variant="outlined"
          color="from-theme"
          role="combobox"
          aria-label={labels.value}
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={options.length === 0}
          className="h-9 w-full min-w-0 justify-between px-2.5 font-normal"
        >
          <span className="min-w-0 flex-1 truncate text-left whitespace-nowrap">
            {selectedCountLabel}
          </span>
          <Icon
            icon="lucide:chevron-down"
            fontSize={16}
            className={open ? 'shrink-0 rotate-180 opacity-60' : 'shrink-0 opacity-60'}
          />
        </Button>
      }
    >
      <div
        role="listbox"
        aria-label={labels.value}
        aria-multiselectable="true"
        className="flex max-h-56 min-h-0 w-full flex-col gap-0.5 overflow-x-hidden overflow-y-auto"
      >
        {options.map((option) => {
          const checked = selectedValues.includes(option.id)
          return (
            <div
              key={option.id}
              role="option"
              aria-selected={checked}
              className="w-full min-w-0 rounded px-2 py-1.5 transition-colors hover:bg-active"
            >
              <Checkbox
                label={option.label}
                checked={checked}
                onCheckedChange={(next) =>
                  onChange(
                    next
                      ? [...selectedValues, option.id]
                      : selectedValues.filter((candidate) => candidate !== option.id),
                  )
                }
                className="w-full min-w-0"
              />
            </div>
          )
        })}
      </div>
    </Popover>
  )
}

function CheckboxValue({ values, onChange, labels }: ValueEditorProps) {
  return (
    <Select
      aria-label={labels.value}
      value={values[0] ?? ''}
      onValueChange={(value) => onChange([value])}
      options={[
        { value: 'true', label: labels.true },
        { value: 'false', label: labels.false },
      ]}
    />
  )
}

const VALUE_EDITORS = {
  text: SingleTextValue,
  number: NumericValue,
  select: SelectValue,
  date: DateValue,
  dateRange: DateRangeValue,
  checkbox: CheckboxValue,
} satisfies Record<FilterValueInput, ComponentType<ValueEditorProps>>

export interface FilterPopoverProps {
  columns: HeaderCol[]
  columnTypes: Record<string, ColumnDataType>
  labels: FilterPopoverLabels
  filterCount: number
  disabled?: boolean
  onAdd: (clause: ViewFilterClause) => void
  onClear?: () => void
}

/** Editor declarativo “Onde coluna condição valor”, dirigido por mappedFilters. */
export function FilterPopover({
  columns,
  columnTypes,
  labels,
  filterCount,
  disabled,
  onAdd,
  onClear,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false)
  const [columnId, setColumnId] = useState(columns[0]?.id ?? '')
  const selectedColumn = columns.find((column) => column.id === columnId) ?? columns[0]
  const selectedType = selectedColumn ? columnTypes[selectedColumn.id] : undefined
  const defaultCondition = selectedType ? mappedFilters[selectedType].defaultCondition : 'equals'
  const [condition, setCondition] = useState<FilterCondition>(defaultCondition)
  const [values, setValues] = useState<string[]>([])

  useEffect(() => {
    const firstColumn = columns[0]
    if (!firstColumn || columns.some((column) => column.id === columnId)) return
    const firstType = columnTypes[firstColumn.id] ?? 'text'
    setColumnId(firstColumn.id)
    setCondition(mappedFilters[firstType].defaultCondition)
    setValues([])
  }, [columnId, columns, columnTypes])

  useEffect(() => {
    if (
      !selectedType ||
      mappedFilters[selectedType].conditions.some((candidate) => candidate.id === condition)
    ) {
      return
    }
    const nextDefinition = mappedFilters[selectedType].conditions[0]
    setCondition(mappedFilters[selectedType].defaultCondition)
    setValues(nextDefinition?.arity === 2 ? ['', ''] : [])
  }, [condition, selectedType])

  const definition = selectedType
    ? mappedFilters[selectedType].conditions.find((candidate) => candidate.id === condition) ??
      mappedFilters[selectedType].conditions[0]
    : undefined
  const ValueEditor = definition ? VALUE_EDITORS[definition.input] : null
  const canAdd = Boolean(selectedColumn && definition?.accepts(values))

  const columnOptions = useMemo(
    () => columns.map((column) => ({ value: column.id, label: column.title })),
    [columns],
  )
  const conditionOptions = (selectedType ? mappedFilters[selectedType].conditions : []).map(
    (candidate) => ({
      value: candidate.id,
      label: labels.conditions[candidate.id],
    }),
  )

  const resetForColumn = (nextColumnId: string) => {
    const nextType = columnTypes[nextColumnId] ?? 'text'
    const nextDefinition = mappedFilters[nextType].conditions[0]
    setColumnId(nextColumnId)
    setCondition(mappedFilters[nextType].defaultCondition)
    setValues(nextDefinition?.arity === 2 ? ['', ''] : [])
  }

  const resetForCondition = (nextCondition: string) => {
    const typedCondition = nextCondition as FilterCondition
    const nextDefinition = selectedType
      ? mappedFilters[selectedType].conditions.find((candidate) => candidate.id === typedCondition)
      : undefined
    setCondition(typedCondition)
    setValues(nextDefinition?.arity === 2 ? ['', ''] : [])
  }

  const handleAdd = () => {
    if (!selectedColumn || !definition || !definition.accepts(values)) return
    onAdd({ columnId: selectedColumn.id, condition: definition.id, values })
    setValues(definition.arity === 2 ? ['', ''] : [])
    setOpen(false)
  }

  const handleClear = () => {
    onClear?.()
    setValues(definition?.arity === 2 ? ['', ''] : [])
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="w-[min(36rem,calc(100vw-2rem))] p-3"
      trigger={
        <Button
          variant="outlined"
          color="from-theme"
          disabled={disabled || columns.length === 0}
          aria-expanded={open}
          className="h-8 gap-1.5 px-2 font-normal"
        >
          <Icon icon="cuida:filter-outline" fontSize={17} />
          {labels.trigger}
          {filterCount > 0 ? (
            <span className="rounded-full bg-p-purple-500/15 px-1.5 text-xs font-semibold text-p-purple">
              {filterCount}
            </span>
          ) : null}
          <Icon icon="lucide:chevron-down" fontSize={14} className="opacity-60" />
        </Button>
      }
    >
      <p className="mb-2 text-sm font-semibold">{labels.where}</p>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <Select
            aria-label={labels.column}
            value={selectedColumn?.id ?? ''}
            onValueChange={resetForColumn}
            options={columnOptions}
            className="min-w-0"
          />
        </div>
        <div className="min-w-0">
          <Select
            aria-label={labels.condition}
            value={definition?.id ?? ''}
            onValueChange={resetForCondition}
            options={conditionOptions}
            className="min-w-0"
          />
        </div>
        {selectedColumn && ValueEditor ? (
          <div className="col-span-2 min-w-0">
            <ValueEditor
              values={values}
              onChange={setValues}
              column={selectedColumn}
              labels={labels}
            />
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="text"
          color="from-theme"
          disabled={!onClear || filterCount === 0}
          onClick={handleClear}
        >
          {labels.clear ?? 'Limpar filtros'}
        </Button>
        <Button variant="filled" color="purple" disabled={!canAdd} onClick={handleAdd}>
          {labels.add}
        </Button>
      </div>
    </Popover>
  )
}
