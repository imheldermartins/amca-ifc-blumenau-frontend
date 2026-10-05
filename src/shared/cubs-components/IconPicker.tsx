import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from './Button'
import { Popover } from './Popover'
import { TextField } from './TextField'
import { cn } from './lib/utils'
import { SOFT_SELECTION_CLASSES } from './menuStyles'
import { loadIconCatalog, type CatalogIcon, type IconCatalogOption } from './iconCatalog'

export interface IconPickerLabels {
  choose: string
  search: string
  empty: string
  loading: string
  loadMore: string
}

export interface IconPickerProps {
  label: string
  labels: IconPickerLabels
  value?: CatalogIcon
  onValueChange?: (value: CatalogIcon) => void
  onBlur?: () => void
  disabled?: boolean
  errorMessage?: string
  className?: string
  /** Ícone editável usado em cabeçalhos; mantém o catálogo e o popover. */
  variant?: 'field' | 'icon'
  /** Injeção opcional para catálogos de host/teste; o padrão cobre Cuida + Lucide. */
  loadCatalog?: () => Promise<IconCatalogOption[]>
}

const PAGE_SIZE = 96

export function IconPicker({
  label,
  labels,
  value,
  onValueChange,
  onBlur,
  disabled,
  errorMessage,
  className,
  variant = 'field',
  loadCatalog = loadIconCatalog,
}: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [catalog, setCatalog] = useState<IconCatalogOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || catalog.length > 0) return
    let active = true
    setLoading(true)
    void loadCatalog()
      .then((loaded) => { if (active) setCatalog(loaded) })
      .catch(() => { if (active) setCatalog([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [catalog.length, loadCatalog, open])

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
      <span className={variant === 'icon' ? 'sr-only' : undefined}>{label}</span>
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
              variant === 'icon'
                ? `relative size-16 shrink-0 rounded-2xl p-0 ${SOFT_SELECTION_CLASSES}`
                : 'h-10 w-full justify-start rounded border border-divider bg-background px-2.5',
              'focus-visible:border-divider-contrast focus-visible:ring-2 focus-visible:ring-foreground/20',
              errorMessage && 'border-p-red',
            )}
          >
            <Icon icon={value ?? 'lucide:shapes'} className={variant === 'icon' ? 'size-8 shrink-0' : 'size-5 shrink-0'} />
            {variant === 'icon'
              ? <span className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-lg border border-divider bg-background text-foreground"><Icon icon="lucide:pencil" className="size-3" /></span>
              : <span className="truncate font-normal">{selectedName ?? labels.choose}</span>}
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
            <p className="py-8 text-center text-sm text-dark-100 dark:text-light-900">{labels.loading}</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-dark-100 dark:text-light-900">{labels.empty}</p>
          ) : (
            <div role="listbox" aria-label={label} className="grid max-h-72 grid-cols-4 gap-1 overflow-y-auto pr-1 sm:grid-cols-6">
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
                    value === option.value && SOFT_SELECTION_CLASSES,
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
          {limit < filtered.length ? (
            <Button type="button" variant="text" color="from-theme" className="w-full bg-active" onClick={() => setLimit((current) => current + PAGE_SIZE)}>
              {labels.loadMore}
            </Button>
          ) : null}
        </div>
      </Popover>
      {errorMessage ? <span role="alert" className="text-xs font-normal text-p-red">{errorMessage}</span> : null}
    </div>
  )
}
