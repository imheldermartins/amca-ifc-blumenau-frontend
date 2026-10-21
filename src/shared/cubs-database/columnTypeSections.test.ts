import { describe, expect, it } from 'vitest'

import { COLUMN_TYPE_SECTIONS } from './columnTypeSections'

describe('COLUMN_TYPE_SECTIONS', () => {
  it('mantém Base primeiro, Automação no meio e Avançado por último', () => {
    expect(COLUMN_TYPE_SECTIONS).toEqual({
      base: ['text', 'numeric', 'select', 'date', 'checkbox'],
      automation: ['flow'],
      advanced: ['relation', 'extract_as', 'formula'],
    })
  })
})
