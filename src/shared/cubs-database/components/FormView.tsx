import { Icon } from '@iconify/react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, cn, type DatePickerLabels } from 'cubs-components'

import { formFieldColumns, formInputFieldFromColumn } from '../formView'
import type { FormSubmissionInput, FormViewConfig, HeaderCol } from '../types'
import { useSortableSensors } from './dndSensors'
import { FormFieldControl } from './FormFieldControl'

export type FormViewMode = 'builder' | 'preview'

export interface FormViewLabels {
  builder: string
  preview: string
  fields: string
  noFields: string
  noFlow: string
  hideField: string
  showField: string
  hiddenField: string
  submitUnavailable: string
  submitError: string
  submitSuccess: string
  datePicker?: DatePickerLabels
}

export interface FormViewProps {
  lockedColumnKeys?: ReadonlySet<string>
  columns: HeaderCol[]
  config?: FormViewConfig
  onConfigChange?: (config: FormViewConfig) => void
  onSubmit?: (input: FormSubmissionInput) => Promise<unknown>
  onFieldOrderChange?: (orderedHeaderCols: string[]) => void
  labels?: Partial<FormViewLabels>
  className?: string
  initialMode?: FormViewMode
  showModeSwitch?: boolean
  /** Target no header da view. `undefined` mantém o fallback inline standalone. */
  headerPortalTarget?: HTMLElement | null
}

const DEFAULT_LABELS: FormViewLabels = {
  builder: 'Criar formulário',
  preview: 'Visualizar formulário',
  fields: 'Campos do formulário',
  noFields: 'Não há campos visíveis para preenchimento.',
  noFlow: 'O Flow vinculado não está disponível.',
  hideField: 'Ocultar do preenchimento',
  showField: 'Mostrar no preenchimento',
  hiddenField: 'Oculto no preenchimento',
  submitUnavailable: 'O envio não está disponível.',
  submitError: 'Não foi possível enviar o formulário.',
  submitSuccess: 'Resposta enviada com sucesso.',
}

function answerKey(column: HeaderCol): string {
  return column.publicKey?.key ?? (column.key === 'title' ? 'title' : column.id)
}

function serializeValue(column: HeaderCol, raw: unknown): unknown {
  if (column.type === 'numeric') return raw === '' ? undefined : Number(raw)
  return raw
}

function SortableFormField({
  column,
  index,
  sortable,
  hidden,
  labels,
  onToggleHidden,
}: {
  column: HeaderCol
  index: number
  sortable: boolean
  hidden: boolean
  labels: FormViewLabels
  onToggleHidden?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled: !sortable,
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-divider bg-background p-3 shadow-sm',
        isDragging && 'opacity-60 shadow-lg',
        hidden && 'bg-contrast/35',
      )}
    >
      <button
        type="button"
        aria-label={`Reordenar ${column.title}`}
        disabled={!sortable}
        className="cursor-grab touch-none rounded p-1 opacity-35 hover:opacity-80 disabled:cursor-default"
        {...attributes}
        {...listeners}
      >
        <Icon icon="lucide:grip-vertical" className="size-4" aria-hidden="true" />
      </button>
      <div className="min-w-0">
        <FormFieldControl
          field={formInputFieldFromColumn(column)}
          name={column.id}
          disabled
          datePickerLabels={labels.datePicker}
        />
        <p className="mt-1 min-h-4 text-xs opacity-50">
          {hidden ? labels.hiddenField : `${index + 1}`}
        </p>
      </div>
      <button
        type="button"
        aria-label={`${hidden ? labels.showField : labels.hideField}: ${column.title}`}
        title={hidden ? labels.showField : labels.hideField}
        disabled={!onToggleHidden}
        onClick={onToggleHidden}
        className="rounded-lg p-2 opacity-55 transition-colors hover:bg-active hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30"
      >
        <Icon icon={hidden ? 'lucide:eye-off' : 'lucide:eye'} className="size-4" />
      </button>
    </div>
  )
}

export function FormView({
  lockedColumnKeys,
  columns,
  config,
  onConfigChange,
  onSubmit,
  onFieldOrderChange,
  labels,
  className,
  initialMode = 'builder',
  showModeSwitch = true,
  headerPortalTarget,
}: FormViewProps) {
  const text: FormViewLabels = { ...DEFAULT_LABELS, ...labels }
  const sensors = useSortableSensors()
  const methods = useForm<Record<string, unknown>>({ shouldUnregister: true })
  const [mode, setMode] = useState<FormViewMode>(initialMode)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const requestIdRef = useRef(crypto.randomUUID())
  const sourceFields = useMemo(() => formFieldColumns(columns), [columns])
  const [orderedFieldIds, setOrderedFieldIds] = useState(() => sourceFields.map((column) => column.id))
  useEffect(() => setOrderedFieldIds(sourceFields.map((column) => column.id)), [sourceFields])
  const fields = useMemo(() => {
    const byId = new Map(sourceFields.map((column) => [column.id, column]))
    return [
      ...orderedFieldIds.flatMap((id) => byId.get(id) ?? []),
      ...sourceFields.filter((column) => !orderedFieldIds.includes(column.id)),
    ]
  }, [orderedFieldIds, sourceFields])
  const hiddenFieldIds = useMemo(() => new Set(config?.hiddenFieldIds ?? []), [config?.hiddenFieldIds])
  const visibleFields = useMemo(
    () => fields.filter((column) => !hiddenFieldIds.has(column.id)),
    [fields, hiddenFieldIds],
  )
  const flowAvailable = Boolean(
    config && columns.some((column) => column.id === config.flowColumnId && column.type === 'flow'),
  )
  const flowLocked = Boolean(config && lockedColumnKeys?.has(config.flowColumnId))

  const submit = methods.handleSubmit(async (values) => {
    if (!config || !flowAvailable || flowLocked || !onSubmit || status === 'submitting') return
    const answers = visibleFields.flatMap((column) => {
      if (lockedColumnKeys?.has(column.key === 'title' ? 'title' : column.id)) return []
      const raw = values[column.id] ?? (column.type === 'checkbox' ? false : '')
      const value = serializeValue(column, raw)
      return value === undefined || value === '' ? [] : [{ key: answerKey(column), value }]
    })
    setStatus('submitting')
    try {
      await onSubmit({ clientRequestId: requestIdRef.current, fields: answers })
      setStatus('success')
      requestIdRef.current = crypto.randomUUID()
    } catch {
      setStatus('error')
    }
  })

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !onFieldOrderChange) return
    const from = orderedFieldIds.indexOf(String(active.id))
    const to = orderedFieldIds.indexOf(String(over.id))
    if (from < 0 || to < 0) return
    const next = arrayMove(orderedFieldIds, from, to)
    setOrderedFieldIds(next)
    onFieldOrderChange([
      ...next,
      ...columns.filter((column) => column.type === 'flow').map((column) => column.id),
    ])
  }

  const toggleHidden = (columnId: string) => {
    if (!config || !onConfigChange) return
    const next = new Set(config.hiddenFieldIds ?? [])
    if (next.has(columnId)) next.delete(columnId)
    else next.add(columnId)
    onConfigChange({ ...config, hiddenFieldIds: fields.map((field) => field.id).filter((id) => next.has(id)) })
  }

  const modeControls = <div className="flex w-fit rounded-lg border border-divider bg-contrast p-1">
    {(['builder', 'preview'] as const).map((item) => (
      <button
        key={item}
        type="button"
        aria-pressed={mode === item}
        onClick={() => { setMode(item); setStatus('idle') }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          mode === item ? 'bg-background text-foreground shadow-sm' : 'opacity-60 hover:opacity-100',
        )}
      >
        <Icon icon={item === 'builder' ? 'lucide:blocks' : 'lucide:eye'} className="size-4" />
        {item === 'builder' ? text.builder : text.preview}
      </button>
    ))}
  </div>

  return <FormProvider {...methods}>
    {showModeSwitch && headerPortalTarget
      ? createPortal(modeControls, headerPortalTarget)
      : showModeSwitch && headerPortalTarget === undefined
        ? modeControls
        : null}
    <section className={cn('mx-auto grid w-full max-w-3xl gap-5 px-4 py-3', className)}>
      {!config || !flowAvailable ? (
        <div role="alert" className="rounded-xl border border-dashed border-divider-contrast p-5 text-sm opacity-70">
          {text.noFlow}
        </div>
      ) : mode === 'builder' ? (
        <div className="grid gap-3">
          <div>
            <h2 className="font-semibold">{text.fields}</h2>
            <p className="text-sm opacity-60">{fields.length} {fields.length === 1 ? 'campo' : 'campos'}</p>
          </div>
          {fields.length === 0 ? (
            <p className="py-5 text-sm opacity-60">{text.noFields}</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedFieldIds} strategy={verticalListSortingStrategy}>
                <div className="grid gap-3">
                  {fields.map((column, index) => (
                    <SortableFormField
                      key={column.id}
                      column={column}
                      index={index}
                      sortable={Boolean(onFieldOrderChange)}
                      hidden={hiddenFieldIds.has(column.id)}
                      labels={text}
                      onToggleHidden={onConfigChange ? () => toggleHidden(column.id) : undefined}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div className="flex items-center justify-end py-3">
            <Button disabled>
              {config.submitButton.icon ? <Icon icon={config.submitButton.icon} className="size-4" /> : null}
              {config.submitButton.label}
            </Button>
          </div>
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={(event) => { void submit(event) }}>
          {visibleFields.length === 0
            ? <p className="py-5 text-sm opacity-60">{text.noFields}</p>
            : visibleFields.map((column) => <FormFieldControl
                key={column.id}
                field={formInputFieldFromColumn(column)}
                name={column.id}
                disabled={lockedColumnKeys?.has(column.key === 'title' ? 'title' : column.id)}
                datePickerLabels={text.datePicker}
              />)}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p role="status" className={cn('text-sm', status === 'error' && 'text-p-red', status === 'success' && 'text-p-green')}>
              {status === 'success' ? text.submitSuccess : status === 'error' ? text.submitError : !onSubmit ? text.submitUnavailable : ''}
            </p>
            <Button type="submit" disabled={!onSubmit || flowLocked || status === 'submitting'} title={flowLocked ? 'Coluna Flow bloqueada' : undefined}>
              {config.submitButton.icon ? <Icon icon={config.submitButton.icon} className="size-4" /> : null}
              {config.submitButton.label}
            </Button>
          </div>
        </form>
      )}
    </section>
  </FormProvider>
}
