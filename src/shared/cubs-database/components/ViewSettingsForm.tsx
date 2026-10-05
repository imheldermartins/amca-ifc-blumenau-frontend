import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react'
import { Checkbox, IconPicker, Select, Switch, TextField, type IconPickerLabels } from 'cubs-components'

import type { BoardViewConfig, CatalogIcon, DataViewKind, DataViewType, FormViewConfig, HeaderCol } from '../types'
import { createDefaultFormViewConfig } from '../formView'
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

function FormButtonLabelField({
  value,
  label,
  disabled,
  onCommit,
}: {
  value: string
  label: string
  disabled: boolean
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    else if (!next) setDraft(value)
  }
  return (
    <TextField
      label={label}
      value={draft}
      maxLength={80}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
    />
  )
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
  form,
  onFormChange,
  formLabels,
  board,
  onBoardChange,
}: {
  type: DataViewKind
  board?: BoardViewConfig
  onBoardChange?: (patch: BoardViewConfig) => void
  settings: ViewMockSettings
  onChange: (patch: Partial<ViewMockSettings>) => void
  columns?: HeaderCol[]
  calendar?: Pick<DataViewType, 'dateColumnId' | 'colorColumnId' | 'calendarShowPropertyLabels'>
  onCalendarChange?: (patch: Pick<DataViewType, 'dateColumnId' | 'colorColumnId' | 'calendarShowPropertyLabels'>) => void
  calendarLabels?: { dateProperty: string; colorProperty: string; defaultColor: string; showPropertyLabels: string }
  calendarPropertyIds?: string[]
  onCalendarPropertyIdsChange?: (columnIds: string[]) => void
  calendarPropertyLabels?: PrioritySelectLabels
  form?: FormViewConfig
  onFormChange?: (form: FormViewConfig) => void
  formLabels?: {
    flow: string
    buttonLabel: string
    buttonIcon: string
    iconPicker: IconPickerLabels
  }
}) {
  const dateColumns = columns.filter((column) => column.type === 'date')
  const colorColumns = columns.filter((column) => column.type === 'select')
  const activeDateColumnId = calendar?.dateColumnId ?? dateColumns[0]?.id
  const propertyColumns = columns.filter((column) => column.key !== 'title' && column.id !== activeDateColumnId && column.type !== 'flow')
  const visiblePropertyIds = calendarPropertyIds ?? propertyColumns.map((column) => column.id)
  const defaultForm = createDefaultFormViewConfig(columns)
  const activeForm = form ?? defaultForm
  const flowColumns = columns.filter((column) => column.type === 'flow')
  const updateForm = (patch: Partial<FormViewConfig>) => {
    if (!activeForm || !onFormChange) return
    onFormChange({ ...activeForm, ...patch })
  }
  const updateSubmitButton = (patch: Partial<FormViewConfig['submitButton']>) => {
    if (!activeForm || !onFormChange) return
    onFormChange({
      ...activeForm,
      submitButton: { ...activeForm.submitButton, ...patch },
    })
  }
  return (
    <div className="grid gap-4">
      {type === 'board' ? <>
        <Select label="Propriedade do Board" aria-label="Propriedade do Board" value={board?.selectColumnId ?? colorColumns[0]?.id ?? ''}
          disabled={!onBoardChange} options={colorColumns.map((column) => ({ value: column.id, label: column.title }))}
          onValueChange={(selectColumnId) => onBoardChange?.({ selectColumnId, optionOrder: [], collapsedOptionIds: [] })} />
        <Checkbox label="Mostrar nomes das propriedades" checked={board?.showPropertyLabels !== false} disabled={!onBoardChange}
          onCheckedChange={(showPropertyLabels) => onBoardChange?.({ showPropertyLabels })} />
        <CalendarPropertyVisibility options={columns.filter((column) => column.key !== 'title').map((column) => ({ value: column.id, label: column.title }))}
          value={board?.propertyIds ?? columns.filter((column) => column.key !== 'title').map((column) => column.id)}
          onChange={onBoardChange ? (propertyIds) => onBoardChange({ propertyIds }) : undefined} disabled={!onBoardChange}
          labels={calendarPropertyLabels ?? { trigger: 'Propriedades visíveis', search: 'Buscar propriedade', empty: 'Nenhuma propriedade', drag: 'Reordenar propriedade', select: 'Mostrar propriedade', priority: 'Posição', clear: 'Ocultar todas' }} />
      </> : null}
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
      {type === 'form' && activeForm ? <>
        <Select
          label={formLabels?.flow ?? 'Flow executado no envio'}
          aria-label={formLabels?.flow ?? 'Flow executado no envio'}
          value={activeForm.flowColumnId}
          options={flowColumns.map((column) => ({ value: column.id, label: column.title }))}
          disabled={!onFormChange}
          onValueChange={(flowColumnId) => updateForm({ flowColumnId })}
        />
        <FormButtonLabelField
          label={formLabels?.buttonLabel ?? 'Texto do botão'}
          value={activeForm.submitButton.label}
          disabled={!onFormChange}
          onCommit={(label) => updateSubmitButton({ label })}
        />
        <IconPicker
          label={formLabels?.buttonIcon ?? 'Ícone do botão'}
          labels={formLabels?.iconPicker ?? {
            choose: 'Escolher ícone',
            search: 'Buscar ícone',
            empty: 'Nenhum ícone encontrado',
            loading: 'Carregando ícones…',
            loadMore: 'Carregar mais',
          }}
          value={activeForm.submitButton.icon ?? undefined}
          disabled={!onFormChange}
          onValueChange={(icon) => updateSubmitButton({ icon: icon as CatalogIcon })}
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
