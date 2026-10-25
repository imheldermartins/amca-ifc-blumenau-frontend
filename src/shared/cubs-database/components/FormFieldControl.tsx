import {
  Checkbox,
  DatePicker,
  Select,
  TextField,
  type DatePickerLabels,
} from 'cubs-components'

import { useId } from 'react'
import { Controller, useFormContext } from 'react-hook-form'

import type { FormInputField } from '../formView'
import { RelationCellEditor } from './cells/RelationCellEditor'

function RelationFormField({ field, name, disabled }: { field: FormInputField; name: string; disabled: boolean }) {
  const { control } = useFormContext()
  const inputId = useId()
  const column = field.relationColumn ?? { id: field.id, title: field.label, type: 'relation' as const }
  return <Controller name={name} control={control} defaultValue={null} render={({ field: input }) => (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">{field.label}</label>
      <div className="min-h-9 rounded border border-divider bg-background text-sm">
        <RelationCellEditor column={column} rowId={name} value={input.value} onCommit={input.onChange} inputId={inputId} disabled={disabled} />
      </div>
    </div>
  )} />
}

/**
 * Controle único usado pelo builder, preview autenticado e formulário público.
 * Todos os componentes entram pelo modo `name` do react-hook-form; o DatePicker
 * é exatamente a mesma primitiva usada pela célula de data.
 */
export function FormFieldControl({
  field,
  name,
  disabled = false,
  datePickerLabels,
}: {
  field: FormInputField
  name: string
  disabled?: boolean
  datePickerLabels?: DatePickerLabels
}) {
  if (field.type === 'relation') return <RelationFormField field={field} name={name} disabled={disabled} />
  if (field.type === 'checkbox') {
    return <div className="flex min-h-9 items-center rounded border border-divider bg-background px-3">
      <Checkbox name={name} label={field.label} disabled={disabled} />
    </div>
  }
  if (field.type === 'select') {
    return <Select
      name={name}
      label={field.label}
      aria-label={field.label}
      options={field.options ?? []}
      disabled={disabled}
    />
  }
  if (field.type === 'date') {
    return <DatePicker
      name={name}
      label={field.label}
      aria-label={field.label}
      selectionMode="optional-range"
      disabled={disabled}
      labels={datePickerLabels}
      className="w-full"
      triggerClassName="cursor-pointer disabled:cursor-not-allowed"
    />
  }
  return <TextField
    name={name}
    label={field.label}
    type={field.type === 'numeric' ? 'number' : 'text'}
    mask={field.type === 'text' ? field.mask : undefined}
    disabled={disabled}
  />
}
