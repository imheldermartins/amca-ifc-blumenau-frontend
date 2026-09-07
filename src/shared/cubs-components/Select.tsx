import * as RadixSelect from '@radix-ui/react-select'
import { Icon } from '@iconify/react'
import { useController, useFormContext, type RegisterOptions } from 'react-hook-form'

import { PALETTE } from './lib/palette'
import { FLOATING_SURFACE_CLASSES } from './menuStyles'
import { cn } from './lib/utils'
import { Tooltip } from './Tooltip'

export interface SelectOption {
  value: string
  label: string
  /** Ícone opcional exibido tanto no trigger selecionado quanto na lista. */
  icon?: string
  disabled?: boolean
}

interface SelectViewProps {
  /** Valor atual. `''` = nada escolhido (mostra o placeholder). */
  value: string
  onValueChange: (value: string) => void
  options: SelectOption[]
  label?: string
  /** Rótulo acessível quando NÃO há label visível. */
  'aria-label'?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Mensagem de erro a exibir (modo state); no modo form vem do RHF. */
  errorMessage?: string
}

/** Select visual, sempre controlado (recebe value/onValueChange). */
function SelectView({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  disabled,
  className,
  errorMessage,
  'aria-label': ariaLabel,
}: SelectViewProps) {
  const selectedOption = options.find((option) => option.value === value)
  const selectedLabel = selectedOption?.label
  const field = (
    <RadixSelect.Root
      // Radix trata '' como "sem valor"; passar undefined é o que faz o
      // placeholder aparecer em vez de um item vazio selecionado.
      value={value === '' ? undefined : value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Tooltip content={selectedLabel ?? placeholder}>
        <RadixSelect.Trigger
          aria-label={ariaLabel}
          aria-invalid={errorMessage ? true : undefined}
          className={cn(
            'inline-flex h-9 min-w-0 w-full items-center justify-between gap-2 rounded border border-divider',
            'bg-background px-2.5 text-sm font-normal',
            selectedLabel && selectedLabel.length > 24 && 'text-xs',
            'focus-visible:border-divider-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-[placeholder]:text-dark-100 dark:data-[placeholder]:text-light-900',
            errorMessage &&
              cn(PALETTE.red.border, 'focus-visible:ring-rose-300 dark:focus-visible:ring-rose-500'),
          )}
        >
          {selectedOption?.icon ? (
            <Icon
              aria-hidden="true"
              icon={selectedOption.icon}
              fontSize={16}
              className="shrink-0 text-p-purple"
            />
          ) : null}
          <RadixSelect.Value className="min-w-0 flex-1 truncate text-left whitespace-nowrap" placeholder={placeholder} />
          <RadixSelect.Icon asChild>
            <Icon icon="lucide:chevron-down" fontSize={16} className="shrink-0 opacity-60" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
      </Tooltip>

      <RadixSelect.Portal>
        {/* Mesmo "glass" do ContextMenu — as duas superfícies flutuantes do
            projeto usam o mesmo tratamento. */}
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-64 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
            FLOATING_SURFACE_CLASSES,
          )}
        >
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'flex cursor-pointer select-none items-center justify-between gap-2 rounded px-2 py-1 text-sm',
                  'outline-none transition-colors data-[highlighted]:bg-active',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                )}
              >
                <Tooltip content={option.label} side="right">
                  <span
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 truncate whitespace-nowrap',
                      option.label.length > 24 && 'text-xs',
                    )}
                  >
                    {option.icon ? (
                      <Icon
                        aria-hidden="true"
                        icon={option.icon}
                        fontSize={15}
                        className="shrink-0 opacity-70"
                      />
                    ) : null}
                    <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  </span>
                </Tooltip>
                <RadixSelect.ItemIndicator asChild>
                  <Icon icon="lucide:check" fontSize={14} className="shrink-0 text-p-purple" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )

  return (
    <div className={cn('flex flex-col gap-1 text-sm font-medium', className)}>
      {label}
      {field}
      {errorMessage && (
        <span role="alert" className={cn('text-xs font-normal', PALETTE.red.text)}>
          {errorMessage}
        </span>
      )}
    </div>
  )
}

/** Versão ligada ao react-hook-form (via `name` + contexto do <FormProvider>). */
interface FormSelectProps extends Omit<SelectViewProps, 'value' | 'onValueChange'> {
  name: string
  rules?: RegisterOptions
}
function FormSelect({ name, rules, ...rest }: FormSelectProps) {
  const { control } = useFormContext()
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules, defaultValue: '' })

  return (
    <SelectView
      {...rest}
      value={typeof field.value === 'string' ? field.value : ''}
      onValueChange={field.onChange}
      errorMessage={typeof error?.message === 'string' ? error.message : undefined}
    />
  )
}

/**
 * Select dual-mode — o mesmo componente serve nos dois fluxos do projeto:
 *
 *  • via FORM (react-hook-form): dentro de <FormProvider>, se registra sozinho.
 *    <Select name="uf" label="UF" options={ufs} rules={validators.required()} />
 *  • via STATE: controlado à mão.
 *    <Select label="UF" options={ufs} value={uf} onValueChange={setUf} />
 *
 * `name` presente = modo form (exige <FormProvider> acima); sem `name` = modo
 * state (value/onValueChange obrigatórios).
 *
 * Sobre Radix: o teclado (setas, typeahead, Home/End), o portal e o
 * posicionamento são dele — é o que não vale a pena reimplementar. A APARÊNCIA
 * é toda dos tokens do projeto, como no resto do pacote.
 */
export interface SelectProps {
  options: SelectOption[]
  label?: string
  'aria-label'?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Modo state: valor controlado. */
  value?: string
  onValueChange?: (value: string) => void
  /** Modo state: mensagem de erro a exibir. */
  errorMessage?: string
  /** Modo form: nome do campo no react-hook-form. */
  name?: string
  /** Modo form: regras de validação. */
  rules?: RegisterOptions
}

export function Select({ name, rules, value, onValueChange, ...rest }: SelectProps) {
  if (name != null) {
    return <FormSelect name={name} rules={rules} {...rest} />
  }
  return (
    <SelectView value={value ?? ''} onValueChange={onValueChange ?? (() => {})} {...rest} />
  )
}
