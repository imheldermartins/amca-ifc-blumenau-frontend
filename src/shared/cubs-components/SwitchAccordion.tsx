import { useId, type ReactNode } from 'react'
import { useController, useFormContext } from 'react-hook-form'

import { Switch } from './Switch'
import { cn } from './lib/utils'

interface SwitchAccordionBaseProps {
  label: string
  description?: string
  children?: ReactNode
  disabled?: boolean
  className?: string
}

interface SwitchAccordionViewProps extends SwitchAccordionBaseProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function SwitchAccordionView({
  label, description, checked, onCheckedChange, disabled, className, children,
}: SwitchAccordionViewProps) {
  const id = useId()
  const hasChildren = children != null

  return (
    <div className={cn('min-w-0 border-b border-divider last:border-b-0', className)}>
      <div className="flex items-center justify-between gap-6 py-4">
        <div className="min-w-0">
          <label id={`${id}-label`} htmlFor={`${id}-switch`} className="flex items-center gap-2 text-sm font-medium">
            {label}
            {hasChildren && (
              <svg aria-hidden="true" viewBox="0 0 16 16" className={cn('size-3.5 shrink-0', checked && 'rotate-180')} fill="none">
                <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </label>
          {description && <p id={`${id}-description`} className="mt-1 text-sm text-foreground/60">{description}</p>}
        </div>
        <Switch
          id={`${id}-switch`}
          aria-labelledby={`${id}-label`}
          aria-describedby={description ? `${id}-description` : undefined}
          aria-controls={hasChildren ? `${id}-children` : undefined}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
      {hasChildren && (
        <fieldset
          id={`${id}-children`}
          aria-labelledby={`${id}-label`}
          hidden={!checked}
          disabled={disabled || !checked}
          className="mb-4 min-w-0 border-l-2 border-divider pl-5"
        >
          {children}
        </fieldset>
      )}
    </div>
  )
}

export type SwitchAccordionProps = SwitchAccordionBaseProps & (
  | { name: string; checked?: never; onCheckedChange?: never }
  | { name?: never; checked: boolean; onCheckedChange: (checked: boolean) => void }
)

function FormSwitchAccordion({ name, ...rest }: SwitchAccordionBaseProps & { name: string }) {
  const { control } = useFormContext()
  const { field } = useController({ name, control, defaultValue: false })
  return <SwitchAccordionView {...rest} checked={Boolean(field.value)} onCheckedChange={field.onChange} />
}

/** O switch controla a expansão. Filhos preservam o valor, mas ficam desabilitados com o pai desligado. */
export function SwitchAccordion(props: SwitchAccordionProps) {
  if (props.name != null) {
    return <FormSwitchAccordion {...props} name={props.name} />
  }
  return <SwitchAccordionView {...props} />
}
