import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Checkbox, Select, Switch } from 'cubs-components'

import type { DataViewKind, DataViewType, HeaderCol } from '../types'
import { mappedForm, type ViewMockSettings } from '../viewSettings'
import { PrioritySelect, type PrioritySelectLabels } from './PrioritySelect'

function CalendarPropertyVisibility({
  options,
  value,
  onChange,
  labels,
  disabled,
}: {
  options: Array<{ value: string; label: string }>
  value: string[]
  onChange?: (value: string[]) => void
  labels: PrioritySelectLabels
  disabled: boolean
}) {
  const [draft, setDraft] = useState(value)
  const draftRef = useRef(value)
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (dirtyRef.current) return
    draftRef.current = value
    setDraft(value)
  }, [value])

  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    if (!dirtyRef.current) return
    dirtyRef.current = false
    onChangeRef.current?.([...draftRef.current])
  }, [])

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (dirtyRef.current) onChangeRef.current?.([...draftRef.current])
  }, [])

  const updateDraft = (next: string[]) => {
    draftRef.current = next
    dirtyRef.current = true
    setDraft(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 450)
  }

  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
    flush()
  }

  return <div onBlurCapture={handleBlur}>
    <PrioritySelect
      options={options}
      value={draft}
      onValueChange={updateDraft}
      labels={labels}
      icon="lucide:list-ordered"
      inline
      disabled={disabled}
    />
  </div>
}

export function ViewSettingsForm({
  type,
  settings,
  onChange,
  columns = [],
  calendar,
  onCalendarChange,
  calendarLabels,
  calendarPropertyIds,
  onCalendarPropertyIdsChange,
  calendarPropertyLabels,
}: {
  type: DataViewKind
  settings: ViewMockSettings
  onChange: (patch: Partial<ViewMockSettings>) => void
  columns?: HeaderCol[]
  calendar?: Pick<DataViewType, 'dateColumnId' | 'colorColumnId' | 'calendarShowPropertyLabels'>
  onCalendarChange?: (patch: Pick<DataViewType, 'dateColumnId' | 'colorColumnId' | 'calendarShowPropertyLabels'>) => void
  calendarLabels?: { dateProperty: string; colorProperty: string; defaultColor: string; showPropertyLabels: string }
  calendarPropertyIds?: string[]
  onCalendarPropertyIdsChange?: (columnIds: string[]) => void
  calendarPropertyLabels?: PrioritySelectLabels
}) {
  const dateColumns = columns.filter((column) => column.type === 'date')
  const colorColumns = columns.filter((column) => column.type === 'select')
  const activeDateColumnId = calendar?.dateColumnId ?? dateColumns[0]?.id
  const propertyColumns = columns.filter((column) => column.key !== 'title' && column.id !== activeDateColumnId && column.type !== 'flow')
  const visiblePropertyIds = calendarPropertyIds ?? propertyColumns.map((column) => column.id)
  return (
    <div className="grid gap-4">
      {type === 'calendar' ? <>
        <Select label={calendarLabels?.dateProperty ?? 'Propriedade de data'} aria-label={calendarLabels?.dateProperty ?? 'Propriedade de data'}
          value={calendar?.dateColumnId ?? dateColumns[0]?.id ?? ''}
          options={dateColumns.map((column) => ({ value: column.id, label: column.title }))}
          onValueChange={(dateColumnId) => onCalendarChange?.({ dateColumnId })} />
        <Select label={calendarLabels?.colorProperty ?? 'Propriedade de cor'} aria-label={calendarLabels?.colorProperty ?? 'Propriedade de cor'}
          value={calendar?.colorColumnId ?? '__default__'}
          options={[{ value: '__default__', label: calendarLabels?.defaultColor ?? 'Automática (primeira seleção)' }, ...colorColumns.map((column) => ({ value: column.id, label: column.title }))]}
          onValueChange={(value) => onCalendarChange?.({ colorColumnId: value === '__default__' ? null : value })} />
        <div className="flex items-center gap-3 rounded-lg border border-divider px-3 py-2.5">
          <Checkbox
            label={calendarLabels?.showPropertyLabels ?? 'Mostrar nomes das propriedades'}
            checked={calendar?.calendarShowPropertyLabels !== false}
            disabled={!onCalendarChange}
            onCheckedChange={(calendarShowPropertyLabels) => onCalendarChange?.({ calendarShowPropertyLabels })}
          />
        </div>
        <CalendarPropertyVisibility
          options={propertyColumns.map((column) => ({ value: column.id, label: column.title }))}
          value={visiblePropertyIds}
          onChange={onCalendarPropertyIdsChange}
          labels={calendarPropertyLabels ?? { trigger: 'Propriedades visíveis', search: 'Buscar propriedade', empty: 'Nenhuma propriedade', drag: 'Reordenar propriedade', select: 'Mostrar propriedade', priority: 'Posição', clear: 'Ocultar todas' }}
          disabled={!onCalendarPropertyIdsChange}
        />
      </> : null}
      {mappedForm[type].map((field) => (
        <div key={field.key} className="grid gap-2">
          {field.control === 'select' ? (
            <Select
              label={field.label}
              aria-label={field.label}
              value={String(settings[field.key])}
              options={field.options ?? []}
              onValueChange={(value) => onChange({ [field.key]: value })}
            />
          ) : (
            <Switch
              label={field.label}
              checked={Boolean(settings[field.key])}
              onCheckedChange={(checked) => onChange({ [field.key]: checked })}
            />
          )}
        </div>
      ))}
    </div>
  )
}
