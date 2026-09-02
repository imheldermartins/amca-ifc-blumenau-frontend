import { describe, expect, it } from 'vitest'

import { formatRelativeTime, parseApiTimestamp } from './formatRelativeTime'

const NOW = new Date('2026-08-31T18:00:00.000Z')

describe('formatRelativeTime', () => {
  it('interpreta o timestamp sem timezone do rqlite como UTC', () => {
    expect(parseApiTimestamp('2026-08-31 16:00:00')?.toISOString()).toBe(
      '2026-08-31T16:00:00.000Z',
    )
  })

  it.each([
    ['2026-08-31T17:59:30.000Z', 'agora'],
    ['2026-08-31T17:58:00.000Z', 'há 2 minutos'],
    ['2026-08-31T16:00:00.000Z', 'há 2 horas'],
    ['2026-08-29T18:00:00.000Z', 'há 2 dias'],
    ['2026-09-01T18:00:00.000Z', 'em 1 dia'],
  ])('formata %s relativamente', (value, expected) => {
    expect(formatRelativeTime(value, NOW)).toBe(expected)
  })

  it('não inventa texto para um timestamp inválido', () => {
    expect(formatRelativeTime('inválido', NOW)).toBeNull()
  })
})
