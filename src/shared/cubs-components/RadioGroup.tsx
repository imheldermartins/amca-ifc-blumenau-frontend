import { useId } from 'react'
import { useController, useFormContext, type RegisterOptions } from 'react-hook-form'

import { cn } from './lib/utils'

export interface RadioOption {
  value: string
  label: string
}

interface RadioGroupBaseProps {
  label?: string
  'aria-label'?: string
  options: readonly RadioOption[]
  disabled?: boolean
  inline?: boolean
  className?: string
}

interface RadioGroupViewProps extends RadioGroupBaseProps {
  value?: string
  onValueChange?: (value: string) => void
  onBlur?: () => void
  inputName?: string
  errorMessage?: string
}

function RadioGroupView({
  label,
  options,
  value,
  onValueChange,
  onBlur,
  inputName,
  disabled,
  inline = false,
  className,
  errorMessage,
  'aria-label': ariaLabel,
}: RadioGroupViewProps) {
  const fallbackName = useId()
  const groupName = inputName ?? fallbackName

  return (
    <fieldset
      aria-label={ariaLabel}
      aria-invalid={errorMessage ? true : undefined}
      className={cn('min-w-0', className)}
    >
      {label && <legend className="mb-1 text-sm font-medium">{label}</legend>}
      <div className={cn('flex gap-3', inline ? 'flex-row flex-wrap items-center' : 'flex-col')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 text-sm',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option.value}
              checked={value === option.value}
              disabled={disabled}
              onChange={() => onValueChange?.(option.value)}
              onBlur={onBlur}
              className="size-4 accent-p-purple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {errorMessage && <span role="alert" className="mt-1 block text-xs text-p-red">{errorMessage}</span>}
    </fieldset>
  )
}

export interface RadioGroupProps extends RadioGroupBaseProps {
  /** Presente = modo react-hook-form; ausente = modo state. */
  name?: string
  rules?: RegisterOptions
  value?: string
  onValueChange?: (value: string) => void
  errorMessage?: string
}

export function RadioGroup({
  name,
  rules,
  value,
  onValueChange,
  errorMessage,
  ...rest
}: RadioGroupProps) {
  if (name == null) {
    return (
      <RadioGroupView
        {...rest}
        value={value}
        onValueChange={onValueChange}
        errorMessage={errorMessage}
      />
    )
  }

  return <FormRadioGroup name={name} rules={rules} {...rest} />
}

function FormRadioGroup({
  name,
  rules,
  ...rest
}: RadioGroupBaseProps & { name: string; rules?: RegisterOptions }) {
  const { control } = useFormContext()
  const { field, fieldState } = useController({
    name,
    control,
    ...(rules ? { rules } : {}),
  })

  return (
    <RadioGroupView
      {...rest}
      inputName={field.name}
      value={typeof field.value === 'string' ? field.value : undefined}
      onValueChange={field.onChange}
      onBlur={field.onBlur}
      errorMessage={fieldState.error?.message}
    />
  )
}
