/** Wire aceito pelo VALUE_CODECS.date: ISO estrito, opcionalmente start@end. */
const STRICT_ISO =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/

const MASKED_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/
const TIME = /^(\d{2}):(\d{2})$/

export interface DateValuePart {
  iso: string
  /** Texto editável pelo campo mascarado. */
  date: string
  /** Hora/minuto em UTC, sem conversão para o fuso do browser. */
  time: string
  hasTime: boolean
  year: number
  month: number
  day: number
}

export interface ParsedDatePickerValue {
  start: DateValuePart
  end?: DateValuePart
  range: boolean
  hasTime: boolean
}

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function validTime(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

export function parseDateValuePart(iso: string): DateValuePart | null {
  const match = STRICT_ISO.exec(iso)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const milliseconds = Number(match[7])
  if (
    !validDate(year, month, day) ||
    !validTime(hour, minute) ||
    second < 0 ||
    second > 59 ||
    milliseconds < 0 ||
    milliseconds > 999
  ) {
    return null
  }

  return {
    iso,
    date: `${twoDigits(day)}/${twoDigits(month)}/${String(year).padStart(4, '0')}`,
    time: `${twoDigits(hour)}:${twoDigits(minute)}`,
    hasTime: hour !== 0 || minute !== 0 || second !== 0 || milliseconds !== 0,
    year,
    month,
    day,
  }
}

export function parseDatePickerValue(value: unknown): ParsedDatePickerValue | null {
  if (typeof value !== 'string' || value.length === 0) return null
  const parts = value.split('@')
  if (parts.length < 1 || parts.length > 2) return null

  const start = parseDateValuePart(parts[0] ?? '')
  const end = parts.length === 2 ? parseDateValuePart(parts[1] ?? '') : null
  if (!start || (parts.length === 2 && !end)) return null

  return {
    start,
    ...(end && { end }),
    range: Boolean(end),
    hasTime: start.hasTime || Boolean(end?.hasTime),
  }
}

export function parseMaskedDate(value: string): {
  year: number
  month: number
  day: number
} | null {
  const match = MASKED_DATE.exec(value)
  if (!match) return null
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  return validDate(year, month, day) ? { year, month, day } : null
}

/**
 * Máscara/hora → ISO estrito. A montagem usa UTC diretamente: uma data sem
 * hora nunca passa pelo fuso local e sempre termina em `T00:00:00.000Z`.
 */
export function serializeDateValuePart(
  maskedDate: string,
  time: string,
  includeTime: boolean,
): string | null {
  const date = parseMaskedDate(maskedDate)
  if (!date) return null

  let hour = 0
  let minute = 0
  if (includeTime) {
    const match = TIME.exec(time)
    if (!match) return null
    hour = Number(match[1])
    minute = Number(match[2])
    if (!validTime(hour, minute)) return null
  }

  return new Date(
    Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0, 0),
  ).toISOString()
}

export interface SerializeDatePickerValueInput {
  startDate: string
  startTime?: string
  endDate?: string
  endTime?: string
  range: boolean
  includeTime: boolean
}

export function serializeDatePickerValue({
  startDate,
  startTime = '',
  endDate = '',
  endTime = '',
  range,
  includeTime,
}: SerializeDatePickerValueInput): string | null {
  const start = serializeDateValuePart(startDate, startTime, includeTime)
  if (!start) return null
  if (!range) return start

  const end = serializeDateValuePart(endDate, endTime, includeTime)
  if (!end) return null

  // Start/end são semânticos, não a ordem em que foram digitados.
  return start <= end ? `${start}@${end}` : `${end}@${start}`
}

function formatPart(part: DateValuePart): string {
  return part.hasTime ? `${part.date} ${part.time}` : part.date
}

export function formatDatePickerValue(value: unknown, empty = '—'): string {
  const parsed = parseDatePickerValue(value)
  if (!parsed) return empty
  const start = formatPart(parsed.start)
  return parsed.end ? `${start} – ${formatPart(parsed.end)}` : start
}
