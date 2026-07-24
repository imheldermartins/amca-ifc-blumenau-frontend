import type { ComponentProps, ReactNode } from 'react'
import { useFormContext, type RegisterOptions } from 'react-hook-form'

import { applyMask, type MaskName } from './lib/masks'
import { PALETTE } from './lib/palette'
import { cn } from './lib/utils'

/** `md` (h-10) é o campo de formulário; `sm` (h-9) é o de barra/topbar. */
export type TextFieldSize = 'sm' | 'md'

/**
 * Superfície onde o campo está pousado — decide o par fundo/borda.
 *
 * `contrast` usa `divider-contrast` e NÃO `divider` de propósito: sobre
 * `bg-contrast` os dois tons são o MESMO (zinc-200/zinc-800) e a borda sumiria
 * nos dois temas. É o par que a sidebar já usa para superfície elevada.
 *
 * `plain` é o campo SEM cara de campo: borda transparente (o layout não pula),
 * sem fundo e sem anel de focus — para inputs embutidos onde o chrome de
 * formulário atrapalha (a célula editável da tabela). O caller é quem dá o
 * affordance de edição (hover da célula, cursor).
 */
export type TextFieldSurface = 'background' | 'contrast' | 'plain'

const SIZES: Record<TextFieldSize, string> = {
  sm: 'h-9',
  md: 'h-10',
}

const SURFACES: Record<TextFieldSurface, string> = {
  background: 'border-divider bg-background focus-visible:ring-divider',
  contrast: 'border-divider-contrast bg-contrast focus-visible:ring-divider-contrast',
  plain: 'border-transparent bg-transparent focus-visible:ring-0',
}

interface TextFieldBaseProps extends Omit<ComponentProps<'input'>, 'name' | 'size'> {
  /** Rótulo visível. Sem ele, passe `aria-label` — o campo precisa de nome. */
  label?: string
  /** Máscara aplicada enquanto digita (./lib/masks). */
  mask?: MaskName
  /** Altura do campo. Padrão: `md`. */
  size?: TextFieldSize
  /** Par fundo/borda conforme a superfície de trás. Padrão: `background`. */
  surface?: TextFieldSurface
  /** Conteúdo fixo à esquerda dentro do campo (ícone). Não recebe clique. */
  startAdornment?: ReactNode
  /** Conteúdo fixo à direita dentro do campo (botão limpar, unidade...). */
  endAdornment?: ReactNode
  /** Classe do `<input>`; a `className` vai no container. */
  inputClassName?: string
}

interface TextFieldViewProps extends TextFieldBaseProps {
  /** Mensagem de erro a exibir (modo state); no modo form vem do RHF. */
  errorMessage?: string
}

/** Input visual, sempre controlado pelos props que recebe. */
function TextFieldView({
  label,
  mask,
  errorMessage,
  size = 'md',
  surface = 'background',
  startAdornment,
  endAdornment,
  className,
  inputClassName,
  onChange,
  ...props
}: TextFieldViewProps) {
  const field = (
    <span className="relative flex items-center">
      {startAdornment && (
        <span className="pointer-events-none absolute left-3 flex shrink-0 items-center">
          {startAdornment}
        </span>
      )}
      <input
        {...props}
        onChange={(event) => {
          // A máscara re-formata o valor ANTES de o handler (state ou RHF) ler.
          if (mask) {
            event.target.value = applyMask(mask, event.target.value)
          }
          onChange?.(event)
        }}
        // `errorMessage` (modo form/state) força inválido; na ausência dele,
        // respeita um `aria-invalid` explícito das props (ex.: a célula da
        // tabela marca erro sem uma mensagem inline).
        aria-invalid={errorMessage ? true : props['aria-invalid']}
        className={cn(
          'w-full rounded border text-sm font-normal',
          // O ring base vem ANTES da superfície de propósito: é o que permite
          // ao `plain` anulá-lo com `ring-0` (o tailwind-merge fica com o
          // ÚLTIMO conflito — se o ring-2 viesse depois, engoliria o ring-0 e
          // a "edição discreta" ganharia anel de focus).
          'focus-visible:outline-none focus-visible:ring-2',
          SIZES[size],
          SURFACES[surface],
          startAdornment ? 'pl-9' : 'pl-3',
          endAdornment ? 'pr-9' : 'pr-3',
          'placeholder:text-zinc-500 dark:placeholder:text-zinc-400',
          // O "x" nativo do WebKit duplicaria um botão de limpar passado como
          // endAdornment. Só afeta type="search".
          '[&::-webkit-search-cancel-button]:hidden',
          errorMessage &&
            cn(PALETTE.red.border, 'focus-visible:ring-rose-300 dark:focus-visible:ring-rose-500'),
          inputClassName,
        )}
      />
      {endAdornment && (
        <span className="absolute right-2 flex shrink-0 items-center">{endAdornment}</span>
      )}
    </span>
  )

  const body = (
    <>
      {label}
      {field}
      {errorMessage && (
        <span role="alert" className={cn('text-xs font-normal', PALETTE.red.text)}>
          {errorMessage}
        </span>
      )}
    </>
  )

  const stack = cn('flex flex-col gap-1.5 text-sm font-medium', className)

  // Com label visível, o <label> ENVOLVE o input: associação implícita, sem
  // precisar gerar id. Sem label não há o que associar — o nome acessível vem
  // do `aria-label` que o caller passa.
  return label ? <label className={stack}>{body}</label> : <div className={stack}>{body}</div>
}

/** Versão ligada ao react-hook-form (via `name` + contexto do <FormProvider>). */
interface FormTextFieldProps extends TextFieldBaseProps {
  name: string
  rules?: RegisterOptions
}
function FormTextField({ name, rules, onChange, ...rest }: FormTextFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext()

  const registration = register(name, rules)
  const fieldError = errors[name]
  const message = typeof fieldError?.message === 'string' ? fieldError.message : undefined

  return (
    <TextFieldView
      {...rest}
      {...registration}
      errorMessage={message}
      onChange={(event) => {
        void registration.onChange(event)
        onChange?.(event)
      }}
    />
  )
}

/**
 * Input de texto dual-mode — o mesmo componente nos dois fluxos do projeto:
 *
 *  • via FORM (react-hook-form): dentro de <FormProvider>, se registra sozinho.
 *    <TextField name="cpf" label="..." mask="cpf" rules={...} />
 *  • via STATE: controlado à mão.
 *    <TextField label="..." value={valor} onChange={(e) => setValor(e.target.value)}
 *      errorMessage={erro} />
 *
 * `name` presente = modo form (exige <FormProvider> acima). Sem `name`, é um
 * input controlado comum (value/onChange), com `errorMessage` opcional.
 *
 * `size`, `surface` e os adornos existem para que campos sem cara de
 * formulário — a busca da topbar, por exemplo — sejam ESTE componente, e não
 * um `<input>` avulso com classes copiadas.
 */
export interface TextFieldProps extends TextFieldBaseProps {
  /** Modo form: nome do campo no react-hook-form. */
  name?: string
  /** Modo form: regras de validação (validators do app). */
  rules?: RegisterOptions
  /** Modo state: mensagem de erro a exibir. */
  errorMessage?: string
}

export function TextField({ name, rules, errorMessage, ...rest }: TextFieldProps) {
  if (name != null) {
    return <FormTextField name={name} rules={rules} {...rest} />
  }
  return <TextFieldView errorMessage={errorMessage} {...rest} />
}
