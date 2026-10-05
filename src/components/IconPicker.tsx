import { useController, useFormContext, type RegisterOptions } from 'react-hook-form'
import {
  IconPicker as SharedIconPicker,
  type CatalogIcon,
  type IconPickerLabels,
  type IconPickerProps as SharedIconPickerProps,
} from 'cubs-components'

import type { WorkspaceIcon } from '@/services/WorkspaceService'
import { loadWorkspaceIconCatalog } from '@/lib/workspaceIconCatalog'

export type { IconPickerLabels }

export interface IconPickerProps
  extends Omit<SharedIconPickerProps, 'errorMessage' | 'value' | 'onValueChange'> {
  name?: string
  rules?: RegisterOptions
  value?: WorkspaceIcon
  onValueChange?: (value: WorkspaceIcon) => void
  errorMessage?: string
}

/** Adaptador RHF do app; a primitiva e o catálogo são compartilhados. */
export function IconPicker({
  name,
  rules,
  value,
  onValueChange,
  errorMessage,
  ...rest
}: IconPickerProps) {
  if (name == null) {
    return (
      <SharedIconPicker
        {...rest}
        value={value}
        onValueChange={(next) => onValueChange?.(next as WorkspaceIcon)}
        errorMessage={errorMessage}
        loadCatalog={loadWorkspaceIconCatalog}
      />
    )
  }
  return <FormIconPicker {...rest} name={name} rules={rules} onValueChange={onValueChange} />
}

function FormIconPicker({
  name,
  rules,
  onValueChange,
  onBlur,
  ...rest
}: Omit<SharedIconPickerProps, 'value' | 'errorMessage'> & {
  name: string
  rules?: RegisterOptions
}) {
  const { control } = useFormContext()
  const { field, fieldState } = useController({
    name,
    control,
    ...(rules ? { rules } : {}),
  })

  return (
    <SharedIconPicker
      {...rest}
      value={typeof field.value === 'string' ? field.value as CatalogIcon : undefined}
      onValueChange={(next) => { field.onChange(next); onValueChange?.(next) }}
      onBlur={() => { field.onBlur(); onBlur?.() }}
      errorMessage={fieldState.error?.message}
      loadCatalog={loadWorkspaceIconCatalog}
    />
  )
}
