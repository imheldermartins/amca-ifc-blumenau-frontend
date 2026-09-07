import { Icon } from '@iconify/react'
import { useEffect, useMemo, useState } from 'react'
import { useController, useFormContext, type RegisterOptions } from 'react-hook-form'

import { Button } from './Button'
import { Popover } from './Popover'
import { Switch } from './Switch'
import { TextField } from './TextField'
import {
  formatDatePickerValue,
  parseDatePickerValue,
  parseMaskedDate,
  serializeDatePickerValue,
} from './lib/dateValue'
import { PALETTE } from './lib/palette'
import { cn } from './lib/utils'

export type DatePickerSelectionMode = 'single' | 'range' | 'optional-range'

export interface DatePickerLabels {
  chooseDate?: string
  calendar?: string
  previousMonth?: string
  nextMonth?: string
  date?: string
  startDate?: string
  endDate?: string
  time?: string
  startTime?: string
  endTime?: string
  includeTime?: string
  range?: string
  clear?: string
  apply?: string
  invalidDate?: string
  weekdays?: readonly [string, string, string, string, string, string, string]
}

type DatePickerSurface = 'background' | 'contrast' | 'plain'
type DatePickerSize = 'sm' | 'md'

interface DateDraftPart {
  date: string
  time: string
}

const EMPTY_PART: DateDraftPart = { date: '', time: '' }
const DEFAULT_WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

function partFromDate(date: Date): DateDraftPart {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return { date: `${day}/${month}/${date.getUTCFullYear()}`, time: '' }
}

function dateFromPart(part: DateDraftPart): Date | null {
  const parsed = parseMaskedDate(part.date)
  return parsed ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)) : null
}

function dateKey(part: DateDraftPart): number | null {
  return dateFromPart(part)?.getTime() ?? null
}

function sameUtcDay(left: Date, right: Date | null): boolean {
  return Boolean(
    right &&
      left.getUTCFullYear() === right.getUTCFullYear() &&
      left.getUTCMonth() === right.getUTCMonth() &&
      left.getUTCDate() === right.getUTCDate(),
  )
}

function calendarDays(month: Date): Date[] {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
  const firstVisible = new Date(first)
  firstVisible.setUTCDate(first.getUTCDate() - first.getUTCDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisible)
    day.setUTCDate(firstVisible.getUTCDate() + index)
    return day
  })
}

interface DatePickerViewProps {
  value: string | null
  onValueChange: (value: string | null) => void
  label?: string
  'aria-label'?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  surface?: DatePickerSurface
  size?: DatePickerSize
  selectionMode?: DatePickerSelectionMode
  locale?: string
  labels?: DatePickerLabels
  invalid?: boolean
  errorMessage?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onBlur?: () => void
}

function DatePickerView({
  value,
  onValueChange,
  label,
  disabled,
  className,
  triggerClassName,
  surface = 'background',
  size = 'md',
  selectionMode = 'optional-range',
  locale = 'pt-BR',
  labels = {},
  invalid = false,
  errorMessage,
  open,
  onOpenChange,
  onBlur,
  'aria-label': ariaLabel,
}: DatePickerViewProps) {
  const parsedValue = useMemo(() => parseDatePickerValue(value), [value])
  const initialMonth = parsedValue
    ? new Date(Date.UTC(parsedValue.start.year, parsedValue.start.month - 1, 1))
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const [internalOpen, setInternalOpen] = useState(false)
  const [start, setStart] = useState<DateDraftPart>(() =>
    parsedValue
      ? { date: parsedValue.start.date, time: parsedValue.start.time }
      : EMPTY_PART,
  )
  const [end, setEnd] = useState<DateDraftPart>(() =>
    parsedValue?.end ? { date: parsedValue.end.date, time: parsedValue.end.time } : EMPTY_PART,
  )
  const [rangeEnabled, setRangeEnabled] = useState(
    selectionMode === 'range' || (selectionMode === 'optional-range' && Boolean(parsedValue?.range)),
  )
  const [includeTime, setIncludeTime] = useState(Boolean(parsedValue?.hasTime))
  const [visibleMonth, setVisibleMonth] = useState(initialMonth)
  const [selectionStage, setSelectionStage] = useState<'start' | 'end'>('start')
  const resolvedOpen = open ?? internalOpen

  const resetDraft = () => {
    const parsed = parseDatePickerValue(value)
    setStart(
      parsed ? { date: parsed.start.date, time: parsed.start.time } : EMPTY_PART,
    )
    setEnd(parsed?.end ? { date: parsed.end.date, time: parsed.end.time } : EMPTY_PART)
    setRangeEnabled(
      selectionMode === 'range' ||
        (selectionMode === 'optional-range' && Boolean(parsed?.range)),
    )
    setIncludeTime(Boolean(parsed?.hasTime))
    setSelectionStage('start')
    setVisibleMonth(
      parsed
        ? new Date(Date.UTC(parsed.start.year, parsed.start.month - 1, 1))
        : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
    )
  }

  useEffect(() => {
    if (!resolvedOpen) resetDraft()
    // O draft aberto pertence à interação em curso; só sincroniza prop fora dela.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [value, selectionMode, resolvedOpen])

  const changeOpen = (next: boolean) => {
    if (next) resetDraft()
    if (open === undefined) setInternalOpen(next)
    onOpenChange?.(next)
    if (!next) onBlur?.()
  }

  const serialized = serializeDatePickerValue({
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    range: rangeEnabled,
    includeTime,
  })

  const days = useMemo(() => calendarDays(visibleMonth), [visibleMonth])
  const startDate = dateFromPart(start)
  const endDate = dateFromPart(end)
  const startKey = dateKey(start)
  const endKey = dateKey(end)
  const today = new Date()
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(visibleMonth)
  const dayFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  })

  const selectDay = (day: Date) => {
    const picked = partFromDate(day)
    setVisibleMonth(new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1)))

    if (!rangeEnabled) {
      setStart({ ...picked, time: start.time })
      setEnd(EMPTY_PART)
      setSelectionStage('start')
      return
    }

    if (selectionStage === 'start') {
      setStart({ ...picked, time: start.time })
      setEnd(EMPTY_PART)
      setSelectionStage('end')
      return
    }

    const pickedKey = day.getTime()
    const currentStartKey = dateKey(start)
    if (currentStartKey !== null && pickedKey < currentStartKey) {
      setEnd(start)
      setStart({ ...picked, time: end.time || start.time })
    } else {
      setEnd({ ...picked, time: end.time || start.time })
    }
    setSelectionStage('start')
  }

  const setRange = (checked: boolean) => {
    setRangeEnabled(checked)
    setEnd(EMPTY_PART)
    setSelectionStage('start')
  }

  const setTime = (checked: boolean) => {
    setIncludeTime(checked)
    setStart((current) => ({ ...current, time: checked ? current.time || '00:00' : '' }))
    setEnd((current) => ({ ...current, time: checked ? current.time || '00:00' : '' }))
  }

  const apply = () => {
    if (!serialized) return
    onValueChange(serialized)
    changeOpen(false)
  }

  const clear = () => {
    onValueChange(null)
    changeOpen(false)
  }

  const surfaceClasses: Record<DatePickerSurface, string> = {
    background: 'border-divider bg-background',
    contrast: 'border-divider-contrast bg-contrast',
    plain: 'border-transparent bg-transparent focus-visible:border-transparent focus-visible:ring-0',
  }

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel ?? label ?? labels.chooseDate ?? 'Escolher data'}
      aria-invalid={invalid || errorMessage ? true : undefined}
      disabled={disabled}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-2 rounded border px-2.5 text-sm font-normal',
        'focus-visible:border-divider-contrast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8' : 'h-9',
        surfaceClasses[surface],
        errorMessage && cn(PALETTE.red.border, 'focus-visible:ring-rose-300 dark:focus-visible:ring-rose-500'),
        triggerClassName,
      )}
    >
      <span className={cn('min-w-0 flex-1 truncate text-left', !value && 'opacity-60')}>
        {formatDatePickerValue(value)}
      </span>
      <Icon icon="lucide:calendar-days" fontSize={15} className="shrink-0 opacity-60" />
    </button>
  )

  return (
    <div className={cn('flex min-w-0 flex-col gap-1 text-sm font-medium', className)}>
      {label ? <span>{label}</span> : null}
      <Popover
        open={resolvedOpen}
        onOpenChange={changeOpen}
        align="start"
        collisionPadding={8}
        sticky="always"
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
        trigger={trigger}
      >
        <div
          className={cn(
            'min-h-0 overflow-y-auto p-3',
            '[scrollbar-color:var(--p-purple)_transparent] [scrollbar-width:thin]',
            '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent',
            '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-p-purple',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="text"
              color="from-theme"
              aria-label={labels.previousMonth ?? 'Mês anterior'}
              className="size-8 p-0"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() - 1, 1),
                  ),
                )
              }
            >
              <Icon icon="lucide:chevron-left" fontSize={16} />
            </Button>
            <strong className="text-sm capitalize">{monthLabel}</strong>
            <Button
              variant="text"
              color="from-theme"
              aria-label={labels.nextMonth ?? 'Próximo mês'}
              className="size-8 p-0"
              onClick={() =>
                setVisibleMonth(
                  new Date(
                    Date.UTC(visibleMonth.getUTCFullYear(), visibleMonth.getUTCMonth() + 1, 1),
                  ),
                )
              }
            >
              <Icon icon="lucide:chevron-right" fontSize={16} />
            </Button>
          </div>

          <div
            role="grid"
            aria-label={labels.calendar ?? 'Calendário'}
            className="mt-2 grid grid-cols-7 gap-0.5"
          >
            {(labels.weekdays ?? DEFAULT_WEEKDAYS).map((weekday, index) => (
              <span
                key={`${weekday}-${index}`}
                role="columnheader"
                className="py-1 text-center text-[11px] font-semibold opacity-50"
              >
                {weekday}
              </span>
            ))}
            {days.map((day) => {
              const key = day.getTime()
              const selected = sameUtcDay(day, startDate) || sameUtcDay(day, endDate)
              const between =
                rangeEnabled &&
                startKey !== null &&
                endKey !== null &&
                key > Math.min(startKey, endKey) &&
                key < Math.max(startKey, endKey)
              const outside = day.getUTCMonth() !== visibleMonth.getUTCMonth()
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  role="gridcell"
                  aria-label={dayFormatter.format(day)}
                  aria-pressed={selected}
                  aria-current={sameUtcDay(day, todayUtc) ? 'date' : undefined}
                  onClick={() => selectDay(day)}
                  className={cn(
                    'flex size-9 items-center justify-center rounded text-xs font-normal transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple-500/25',
                    outside && 'opacity-35',
                    between && 'bg-p-purple-500/10 text-p-purple',
                    selected
                      ? 'bg-p-purple text-white shadow-sm shadow-p-purple-500/30'
                      : 'hover:bg-active',
                    sameUtcDay(day, todayUtc) && !selected && 'ring-1 ring-inset ring-p-purple/50',
                  )}
                >
                  {day.getUTCDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-divider pt-3">
            {selectionMode === 'optional-range' ? (
              <Switch
                checked={rangeEnabled}
                onCheckedChange={setRange}
                label={labels.range ?? 'Intervalo'}
              />
            ) : null}
            <Switch
              checked={includeTime}
              onCheckedChange={setTime}
              label={labels.includeTime ?? 'Incluir horário'}
            />
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <div
              className={cn(
                'grid min-w-0 gap-2',
                includeTime && 'grid-cols-[minmax(0,1fr)_7rem]',
              )}
            >
              <TextField
                label={rangeEnabled ? labels.startDate ?? 'Data inicial' : labels.date ?? 'Data'}
                mask="date"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={start.date}
                onFocus={() => setSelectionStage('start')}
                onChange={(event) =>
                  setStart((current) => ({ ...current, date: event.target.value }))
                }
              />
              {includeTime ? (
                <TextField
                  type="time"
                  label={
                    rangeEnabled ? labels.startTime ?? 'Hora inicial' : labels.time ?? 'Horário'
                  }
                  value={start.time}
                  onChange={(event) =>
                    setStart((current) => ({ ...current, time: event.target.value }))
                  }
                />
              ) : null}
            </div>

            {rangeEnabled ? (
              <div
                className={cn(
                  'grid min-w-0 gap-2',
                  includeTime && 'grid-cols-[minmax(0,1fr)_7rem]',
                )}
              >
                <TextField
                  label={labels.endDate ?? 'Data final'}
                  mask="date"
                  inputMode="numeric"
                  placeholder="dd/mm/aaaa"
                  value={end.date}
                  onFocus={() => setSelectionStage('end')}
                  onChange={(event) =>
                    setEnd((current) => ({ ...current, date: event.target.value }))
                  }
                />
                {includeTime ? (
                  <TextField
                    type="time"
                    label={labels.endTime ?? 'Hora final'}
                    value={end.time}
                    onChange={(event) =>
                      setEnd((current) => ({ ...current, time: event.target.value }))
                    }
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          {(start.date || end.date) && !serialized ? (
            <span className="mt-2 block text-xs font-normal text-p-red">
              {labels.invalidDate ?? 'Informe uma data válida.'}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-divider bg-glass px-3 py-3 backdrop-blur-2xl">
          <Button variant="text" color="from-theme" onClick={clear}>
            {labels.clear ?? 'Limpar'}
          </Button>
          <Button variant="filled" color="purple" disabled={!serialized} onClick={apply}>
            {labels.apply ?? 'Aplicar'}
          </Button>
        </div>
      </Popover>
      {errorMessage ? (
        <span role="alert" className={cn('text-xs font-normal', PALETTE.red.text)}>
          {errorMessage}
        </span>
      ) : null}
    </div>
  )
}

interface FormDatePickerProps extends Omit<DatePickerViewProps, 'value' | 'onValueChange'> {
  name: string
  rules?: RegisterOptions
  defaultValue?: string | null
}

function FormDatePicker({ name, rules, defaultValue = null, ...rest }: FormDatePickerProps) {
  const { control } = useFormContext()
  const {
    field,
    fieldState: { error },
  } = useController({ name, control, rules, defaultValue })

  return (
    <DatePickerView
      {...rest}
      value={typeof field.value === 'string' ? field.value : null}
      onValueChange={field.onChange}
      onBlur={field.onBlur}
      errorMessage={typeof error?.message === 'string' ? error.message : undefined}
    />
  )
}

/**
 * Date picker dual-mode. O valor público já é o wire da API:
 * `ISO` para data única ou `startISO@endISO` para intervalo.
 */
export interface DatePickerProps {
  label?: string
  'aria-label'?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  surface?: DatePickerSurface
  size?: DatePickerSize
  selectionMode?: DatePickerSelectionMode
  locale?: string
  labels?: DatePickerLabels
  invalid?: boolean
  /** Modo state. */
  value?: string | null
  onValueChange?: (value: string | null) => void
  errorMessage?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Modo form. */
  name?: string
  rules?: RegisterOptions
  defaultValue?: string | null
}

export function DatePicker({
  name,
  rules,
  defaultValue,
  value,
  onValueChange,
  ...rest
}: DatePickerProps) {
  if (name != null) {
    return <FormDatePicker name={name} rules={rules} defaultValue={defaultValue} {...rest} />
  }
  return (
    <DatePickerView
      value={value ?? null}
      onValueChange={onValueChange ?? (() => undefined)}
      {...rest}
    />
  )
}
