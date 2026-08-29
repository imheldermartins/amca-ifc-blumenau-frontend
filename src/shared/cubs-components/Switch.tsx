import { useController, useFormContext } from 'react-hook-form'

import { cn } from './lib/utils'

interface SwitchViewProps {
  /** Estado atual do switch. */
  checked: boolean
  /** Recebe o novo estado ao alternar. */
  onCheckedChange: (checked: boolean) => void
  /** Label opcional (à direita do switch). */
  label?: string
  disabled?: boolean
  className?: string
}

/** Switch visual, sempre controlado (recebe checked/onCheckedChange). */
function SwitchView({ checked, onCheckedChange, label, disabled, className }: SwitchViewProps) {
  return (
    <label
      className={cn(
        'inline-flex select-none items-center gap-2 text-sm text-nowrap whitespace-nowrap',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
          checked ? 'bg-p-purple' : 'bg-divider-contrast',
        )}
      >
        <span
          className={cn(
            'size-4 rounded-full bg-light-100 shadow-sm transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
      {label && <span>{label}</span>}
    </label>
  )
}

/** Versão ligada ao react-hook-form (via `name` + contexto do <FormProvider>). */
interface FormSwitchProps extends Omit<SwitchViewProps, 'checked' | 'onCheckedChange'> {
  name: string
}
function FormSwitch({ name, ...rest }: FormSwitchProps) {
  const { control } = useFormContext()
  const { field } = useController({ name, control, defaultValue: false })
  return <SwitchView checked={Boolean(field.value)} onCheckedChange={field.onChange} {...rest} />
}

/**
 * Switch dual-mode — o mesmo componente serve nos dois fluxos do projeto:
 *
 *  • via STATE:  <Switch checked={ativo} onCheckedChange={setAtivo} label="..." />
 *  • via FORM:   dentro de <FormProvider>, <Switch name="ativo" label="..." />
 *    (se registra sozinho no react-hook-form, igual ao TextField)
 *
 * `name` presente = modo form (exige <FormProvider> acima); sem `name` = modo
 * state (checked/onCheckedChange obrigatórios).
 */
export interface SwitchProps {
  label?: string
  disabled?: boolean
  className?: string
  /** Modo state: estado controlado. */
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Modo form: nome do campo no react-hook-form. */
  name?: string
}

export function Switch({ name, checked, onCheckedChange, ...rest }: SwitchProps) {
  if (name != null) {
    return <FormSwitch name={name} {...rest} />
  }
  return (
    <SwitchView checked={checked ?? false} onCheckedChange={onCheckedChange ?? (() => {})} {...rest} />
  )
}
