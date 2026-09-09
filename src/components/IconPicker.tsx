import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'
import { useController, useFormContext, type RegisterOptions } from 'react-hook-form'
import { Button, Popover, TextField, cn } from 'cubs-components'

import {
  loadWorkspaceIconCatalog,
  type WorkspaceIconOption,
} from '@/lib/workspaceIconCatalog'
import type { WorkspaceIcon } from '@/services/WorkspaceService'

export interface IconPickerLabels {
  choose: string
  search: string
  empty: string
  loading: string
  loadMore: string
}


interface IconPickerViewProps {
  label: string
  labels: IconPickerLabels
  value?: WorkspaceIcon
  onValueChange?: (value: WorkspaceIcon) => void
  onBlur?: () => void
  disabled?: boolean
  errorMessage?: string
  className?: string
}

const PAGE_SIZE = 96

function IconPickerView({
  label,
  labels,
  value,
  onValueChange,
  onBlur,
  disabled,
  errorMessage,
  className,
}: IconPickerViewProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [catalog, setCatalog] = useState<WorkspaceIconOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || catalog.length > 0) return
    let active = true
    setLoading(true)
    void loadWorkspaceIconCatalog()
      .then((loaded) => {
        if (active) setCatalog(loaded)
      })
      .catch(() => {
        if (active) setCatalog([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [open, catalog.length])

  useEffect(() => setLimit(PAGE_SIZE), [query])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR')
    return catalog
      .filter((option) =>
        !normalized || option.name.toLocaleLowerCase('pt-BR').includes(normalized),
      )
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }, [catalog, query])

  const selectedName = value?.replace(/^(?:cuida|lucide):/, '')

  return (
    <div className={cn('flex flex-col gap-1 text-sm font-medium', className)}>
      <span>{label}</span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) onBlur?.()
        }}
        align="start"
        collisionPadding={12}
        className="w-[min(30rem,calc(100vw-1.5rem))] p-3"
        trigger={
          <Button
            type="button"
            variant="text"
            color="from-theme"
            disabled={disabled}
            aria-label={label}
            aria-invalid={errorMessage ? true : undefined}
            className={cn(
              'h-10 w-full justify-start rounded border border-divider bg-background px-2.5',
              'focus-visible:border-divider-contrast focus-visible:ring-2 focus-visible:ring-foreground/20',
              errorMessage && 'border-p-red',
            )}
          >
            <Icon icon={value ?? 'lucide:shapes'} className="size-5 shrink-0" />
            <span className="truncate font-normal">
              {selectedName ?? labels.choose}
            </span>
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <TextField
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={labels.search}
            placeholder={labels.search}
            size="sm"
            startAdornment={<Icon icon="lucide:search" className="size-4" />}
          />

          {loading ? (
            <p className="py-8 text-center text-sm text-dark-100 dark:text-light-900">
              {labels.loading}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-dark-100 dark:text-light-900">
              {labels.empty}
            </p>
          ) : (
            <div
              role="listbox"
              aria-label={label}
              className="grid max-h-72 grid-cols-4 gap-1 overflow-y-auto pr-1 sm:grid-cols-6"
            >
              {filtered.slice(0, limit).map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  aria-label={option.name}
                  title={option.name}
                  variant="text"
                  color="from-theme"
                  className={cn(
                    'aspect-square h-auto min-w-0 flex-col gap-1 overflow-hidden p-1',
                    value === option.value && 'bg-p-purple text-white',
                  )}
                  onClick={() => {
                    onValueChange?.(option.value)
                    setOpen(false)
                    onBlur?.()
                  }}
                >
                  <Icon icon={option.value} className="size-5 shrink-0" />
                  <span className="w-full truncate text-[9px] font-normal">{option.name}</span>
                </Button>
              ))}
            </div>
          )}

          {limit < filtered.length && (
            <Button
              type="button"
              variant="text"
              color="from-theme"
              className="w-full bg-active"
              onClick={() => setLimit((current) => current + PAGE_SIZE)}
            >
              {labels.loadMore}
            </Button>
          )}
        </div>
      </Popover>
      {errorMessage && <span role="alert" className="text-xs font-normal text-p-red">{errorMessage}</span>}
    </div>
  )
}

export interface IconPickerProps extends Omit<IconPickerViewProps, 'onBlur' | 'errorMessage'> {
  name?: string
  rules?: RegisterOptions
  errorMessage?: string
}

export function IconPicker({ name, rules, value, onValueChange, errorMessage, ...rest }: IconPickerProps) {
  if (name == null) {
    return (
      <IconPickerView
        {...rest}
        value={value}
        onValueChange={onValueChange}
        errorMessage={errorMessage}
      />
    )
  }
  return <FormIconPicker {...rest} name={name} rules={rules} />
}

function FormIconPicker({
  name,
  rules,
  ...rest
}: Omit<IconPickerViewProps, 'value' | 'onValueChange' | 'onBlur' | 'errorMessage'> & {
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
    <IconPickerView
      {...rest}
      value={typeof field.value === 'string' ? field.value as WorkspaceIcon : undefined}
      onValueChange={field.onChange}
      onBlur={field.onBlur}
      errorMessage={fieldState.error?.message}
    />
  )
}
