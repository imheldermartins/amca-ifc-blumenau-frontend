import { describe, expect, it } from 'vitest'

import {
  formatDatePickerValue,
  parseDatePickerValue,
  serializeDatePickerValue,
  serializeDateValuePart,
} from './dateValue'

describe('dateValue — wire da API', () => {
  it('zera hora e monta UTC sem passar pelo fuso do browser', () => {
    expect(serializeDateValuePart('04/09/2026', '', false)).toBe(
      '2026-09-04T00:00:00.000Z',
    )
  })

  it('preserva hora opcional no mesmo ISO estrito', () => {
    expect(serializeDateValuePart('04/09/2026', '14:30', true)).toBe(
      '2026-09-04T14:30:00.000Z',
    )
  })

  it('serializa intervalo start@end e normaliza datas digitadas ao contrário', () => {
    expect(
      serializeDatePickerValue({
        startDate: '10/09/2026',
        startTime: '18:00',
        endDate: '04/09/2026',
        endTime: '09:15',
        range: true,
        includeTime: true,
      }),
    ).toBe('2026-09-04T09:15:00.000Z@2026-09-10T18:00:00.000Z')
  })

  it('rejeita datas e horas inexistentes', () => {
    expect(serializeDateValuePart('31/02/2026', '', false)).toBeNull()
    expect(serializeDateValuePart('04/09/2026', '24:00', true)).toBeNull()
  })

  it('lê e apresenta data simples e intervalo sem expor o wire', () => {
    const range =
      '2026-09-04T00:00:00.000Z@2026-09-10T18:30:00.000Z'

    expect(parseDatePickerValue(range)).toMatchObject({
      range: true,
      hasTime: true,
      start: { date: '04/09/2026', time: '00:00', hasTime: false },
      end: { date: '10/09/2026', time: '18:30', hasTime: true },
    })
    expect(formatDatePickerValue(range)).toBe('04/09/2026 – 10/09/2026 18:30')
    expect(formatDatePickerValue(null)).toBe('—')
  })
})
