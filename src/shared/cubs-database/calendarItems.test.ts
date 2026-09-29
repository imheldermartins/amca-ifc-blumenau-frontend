import { describe, expect, it } from 'vitest'
import { databaseCalendarItems } from './calendarItems'
import type { HeaderCol, RowData } from './types'

const columns: HeaderCol[] = [
  { id: 'title', key: 'title', title: 'Nome', type: 'text' },
  { id: 'date', title: 'Data', type: 'date' },
  { id: 'status', title: 'Status', type: 'select', options: [{ id: 'doing', label: 'Em andamento', color: 'green' }] },
]

describe('database calendar projection', () => {
  it('adapts the inclusive date codec without mutating pages or properties', () => {
    const rows: RowData[] = [{ id: 'p1', cells: { title: { value: 'Entrega' }, date: { value: '2026-09-28T00:00:00.000Z@2026-09-30T00:00:00.000Z' }, status: { value: 'doing' } } }]
    const before = JSON.stringify(rows)
    expect(databaseCalendarItems(rows, columns)).toMatchObject([{
      id: 'p1', title: 'Entrega', start: '2026-09-28T00:00:00.000Z', end: '2026-10-01T00:00:00.000Z', allDay: true, color: 'green',
      data: { page: { id: 'p1', title: 'Entrega' }, properties: [{
        id: 'status',
        label: 'Status',
        type: 'select',
        value: 'Em andamento',
        rawValue: 'doing',
      }] },
    }])
    expect(JSON.stringify(rows)).toBe(before)
    expect(databaseCalendarItems(rows, columns, 'date', 'status')[0].color).toBe('green')
  })

  it('uses the first select column by default and an explicit ULID when configured', () => {
    const statusId = '01K6A1B2C3D4E5F6G7H8J9K0MN'
    const priorityId = '01K6N1M2P3Q4R5S6T7V8W9X0YZ'
    const selectable: HeaderCol[] = [columns[0], columns[1],
      { id: statusId, title: 'Status', type: 'select', options: [{ id: 'doing', label: 'Em andamento', color: 'blue' }] },
      { id: priorityId, title: 'Prioridade', type: 'select', options: [{ id: 'high', label: 'Alta', color: 'orange' }] },
    ]
    const row: RowData = { id: 'p1', cells: { title: { value: 'Entrega' }, date: { value: '2026-09-28T00:00:00.000Z' }, [statusId]: { value: 'doing' }, [priorityId]: { value: 'high' } } }
    expect(databaseCalendarItems([row], selectable)[0].color).toBe('blue')
    expect(databaseCalendarItems([row], selectable, 'date', null)[0].color).toBe('blue')
    expect(databaseCalendarItems([row], selectable, 'date', priorityId)[0].color).toBe('orange')
  })

  it('preserves timed endpoints and ignores missing or malformed dates', () => {
    const range = '2026-09-27T09:00:00.000Z@2026-09-27T10:30:00.000Z'
    expect(databaseCalendarItems([{ id: 'p1', cells: { date: { value: range } } }], columns)[0]).toMatchObject({ end: range.split('@')[1], allDay: false })
    expect(databaseCalendarItems([{ id: 'missing', cells: {} }, { id: 'bad', cells: { date: { value: 'yesterday' } } }], columns)).toEqual([])
    expect(databaseCalendarItems([], columns.filter((column) => column.type !== 'date'))).toEqual([])
  })

  it('lists properties in the column order owned by the active view', () => {
    const ordered = [columns[0], columns[1], { id: 'owner', title: 'Responsável', type: 'text' as const }, columns[2]]
    const [item] = databaseCalendarItems([{ id: 'p1', cells: {
      title: { value: 'Entrega' }, date: { value: '2026-09-28T00:00:00.000Z' },
      status: { value: 'doing' }, owner: { value: 'Marina' },
    } }], ordered)
    expect(item.type === 'page' && item.data.properties?.map((property) => property.label)).toEqual(['Responsável', 'Status'])
  })

  it('uses the Calendar visibility list as the ordered property projection', () => {
    const extended = [...columns, { id: 'owner', title: 'Responsável', type: 'text' as const }]
    const row: RowData = { id: 'p1', cells: {
      title: { value: 'Entrega' }, date: { value: '2026-09-28T00:00:00.000Z' },
      status: { value: 'doing' }, owner: { value: 'Marina' },
    } }

    const [filtered] = databaseCalendarItems([row], extended, 'date', 'status', ['owner'])
    expect(filtered.type === 'page' && filtered.data.properties).toMatchObject([
      { id: 'owner', label: 'Responsável', type: 'text', value: 'Marina', rawValue: 'Marina' },
    ])
    const [empty] = databaseCalendarItems([row], extended, 'date', 'status', [])
    expect(empty.type === 'page' && empty.data.properties).toEqual([])
  })
})
