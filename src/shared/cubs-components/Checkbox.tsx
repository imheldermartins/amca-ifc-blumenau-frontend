import * as RadixCheckbox from '@radix-ui/react-checkbox'
import { Icon } from '@iconify/react'
import { useController, useFormContext, type RegisterOptions } from 'react-hook-form'

import { PALETTE } from './lib/palette'
import { cn } from './lib/utils'

/**
 * `indeterminate` é o terceiro estado do checkbox (nem marcado nem desmarcado)
 * — o caso do "selecionar todas" quando só ALGUMAS linhas estão marcadas. Ele
 * é sempre definido por quem controla, nunca produzido por um clique: clicar
 * num indeterminado resolve para marcado.
 */
export type CheckedState = boolean | 'indeterminate'

interface CheckboxViewProps {
  checked: CheckedState
  onCheckedChange: (checked: boolean) => void
  /** Label opcional (à direita da caixa). */
  label?: string
  /** Rótulo acessível quando NÃO há label visível (ex.: checkbox de linha). */
  'aria-label'?: string
  disabled?: boolean
  className?: string
  /** Mensagem de erro a exibir (modo state); no modo form vem do RHF. */
  errorMessage?: string
}

/** Checkbox visual, sempre controlado (recebe checked/onCheckedChange). */
function CheckboxView({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
  errorMessage,
  'aria-label': ariaLabel,
}: CheckboxViewProps) {
  const box = (
    <RadixCheckbox.Root
      checked={checked}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={errorMessage ? true : undefined}
      className={cn(
        'inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-[color,background-color,border-color,box-shadow]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
        checked === false
          ? 'border-divider-contrast bg-background'
          : 'border-p-purple bg-p-purple text-light-100 shadow-sm shadow-p-purple-500/40',
        errorMessage && checked === false && PALETTE.red.border,
        !label && className,
      )}
    >
      <RadixCheckbox.Indicator className="flex items-center justify-center">
        <Icon icon={checked === 'indeterminate' ? 'lucide:minus' : 'lucide:check'} fontSize={12} />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )

  // Sem label visível o componente É a caixa — sem wrapper, para ele caber em
  // grades apertadas (a célula de controles da tabela, por exemplo).
  if (!label) {
    return errorMessage ? (
      <span className="inline-flex flex-col gap-1">
        {box}
        <span role="alert" className={cn('text-xs font-normal', PALETTE.red.text)}>
          {errorMessage}
        </span>
      </span>
    ) : (
      box
    )
  }

  return (
    <span className={cn('inline-flex flex-col gap-1', className)}>
      <label
        className={cn(
          'inline-flex select-none items-center gap-2 text-sm',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
      >
        {box}
        <span>{label}</span>
      </label>
      {errorMessage && (
        <span role="alert" className={cn('text-xs font-normal', PALETTE.red.text)}>
          {errorMessage}
        </span>
      )}
    </span>
  )
}

/** Versão ligada ao react-hook-form (via `name` + contexto do <FormProvider>). */
interface FormCheckboxProps extends Omit<CheckboxViewProps, 'checked' | 'onCheckedChange'> {
  name: string
  rules?: RegisterOptions
}
function FormCheckbox({ name, rules, ...rest }: FormCheckboxProps) {
  const { control } = useFormContext()
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules, defaultValue: false })

  return (
    <CheckboxView
      {...rest}
      checked={Boolean(field.value)}
      onCheckedChange={field.onChange}
      errorMessage={typeof error?.message === 'string' ? error.message : undefined}
    />
  )
}

/**
 * Checkbox dual-mode — o mesmo componente serve nos dois fluxos do projeto:
 *
 *  • via FORM (react-hook-form): dentro de <FormProvider>, se registra sozinho.
 *    <Checkbox name="aceito" label="Aceito os termos" rules={validators.required()} />
 *  • via STATE: controlado à mão.
 *    <Checkbox checked={marcado} onCheckedChange={setMarcado} label="..." />
 *
 * `name` presente = modo form (exige <FormProvider> acima); sem `name` = modo
 * state (checked/onCheckedChange obrigatórios).
 *
 * O terceiro estado (`checked="indeterminate"`) só existe no modo state — é
 * estado de APRESENTAÇÃO de um agregado ("algumas marcadas"), não um valor que
 * um formulário submete.
 */
export interface CheckboxProps {
  label?: string
  'aria-label'?: string
  disabled?: boolean
  className?: string
  /** Modo state: estado controlado. */
  checked?: CheckedState
  onCheckedChange?: (checked: boolean) => void
  /** Modo state: mensagem de erro a exibir. */
  errorMessage?: string
  /** Modo form: nome do campo no react-hook-form. */
  name?: string
  /** Modo form: regras de validação. */
  rules?: RegisterOptions
}

export function Checkbox({ name, rules, checked, onCheckedChange, ...rest }: CheckboxProps) {
  if (name != null) {
    return <FormCheckbox name={name} rules={rules} {...rest} />
  }
  return (
    <CheckboxView
      checked={checked ?? false}
      onCheckedChange={onCheckedChange ?? (() => {})}
      {...rest}
    />
  )
}
