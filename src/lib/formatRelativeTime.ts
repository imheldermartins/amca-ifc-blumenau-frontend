const SQLITE_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/

/**
 * O SQLite/rqlite entrega `CURRENT_TIMESTAMP` sem timezone. Como esse valor é
 * UTC, normalizamos antes de criar o Date; timestamps ISO com offset seguem
 * intactos.
 */
export function parseApiTimestamp(value: string): Date | null {
  const normalized = SQLITE_TIMESTAMP.test(value) ? `${value.replace(' ', 'T')}Z` : value
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Formata um instante como "agora", "há 2 horas" ou "em 3 minutos". */
export function formatRelativeTime(
  value: string,
  now: number | Date = Date.now(),
  locale = 'pt-BR',
): string | null {
  const date = parseApiTimestamp(value)
  if (!date) return null

  const differenceInSeconds = (date.getTime() - new Date(now).getTime()) / 1_000
  const absoluteSeconds = Math.abs(differenceInSeconds)
  if (absoluteSeconds < 45) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second')
  }

  const units = [
    { unit: 'year', seconds: 365 * 24 * 60 * 60 },
    { unit: 'month', seconds: 30 * 24 * 60 * 60 },
    { unit: 'day', seconds: 24 * 60 * 60 },
    { unit: 'hour', seconds: 60 * 60 },
    { unit: 'minute', seconds: 60 },
  ] as const
  const selected = units.find(({ seconds }) => absoluteSeconds >= seconds) ?? units.at(-1)!
  const amount = Math.round(differenceInSeconds / selected.seconds)

  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(
    amount,
    selected.unit,
  )
}
