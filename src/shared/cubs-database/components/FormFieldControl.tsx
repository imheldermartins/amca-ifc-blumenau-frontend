import {
  Checkbox,
  DatePicker,
  Select,
  TextField,
  type DatePickerLabels,
} from 'cubs-components'

import type { FormInputField } from '../formView'

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
