import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { DatabaseCalendarProperty } from '../calendarItems'
import { mappedProps } from '../calendarPropertyRenderers'
import { CalendarProperties } from './CalendarProperties'

afterEach(cleanup)

const properties: DatabaseCalendarProperty[] = [
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    value: 'Em andamento',
    rawValue: 'doing',
    column: {
      id: 'status',
      title: 'Status',
      type: 'select',
      options: [{ id: 'doing', label: 'Em andamento', color: 'green' }],
    },
  },
  {
    id: 'done',
    label: 'Concluído',
    type: 'checkbox',
    value: 'Sim',
    rawValue: true,
    column: { id: 'done', title: 'Concluído', type: 'checkbox' },
  },
  {
    id: 'amount',
    label: 'Valor',
    type: 'numeric',
    value: 'R$ 80,00',
    rawValue: 8000,
    column: { id: 'amount', title: 'Valor', type: 'numeric', format: 'currency' },
  },
]

describe('CalendarProperties', () => {
  it('dispatches every value through mappedProps in a vertical property area', () => {
    render(<CalendarProperties properties={properties} />)

    expect(Object.keys(mappedProps).sort()).toEqual(['checkbox', 'date', 'numeric', 'select', 'text'])
    const area = screen.getByText('Status:').closest('[data-calendar-properties]')
    expect(area?.className).toContain('flex-col')
    expect(area?.className).toContain('justify-start')
    expect(screen.getByText('Em andamento').className).toContain('bg-p-green')
    expect(screen.getByText('Sim')).not.toBeNull()
    expect(screen.getByText('R$ 80,00').className).toContain('tabular-nums')
  })

  it('keeps labels accessible while hiding them visually as one global setting', () => {
    render(<CalendarProperties properties={properties} showLabels={false} />)

    expect(screen.getByText('Status:').className).toContain('sr-only')
    expect(screen.getByText('Em andamento')).not.toBeNull()
  })
})
