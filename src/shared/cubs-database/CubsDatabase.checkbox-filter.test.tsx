import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CubsDatabase } from './CubsDatabase'
import type { DataViewSettings, HeaderCol, RowData } from './types'
import { emptyViewFilters } from './viewFilters'

const columns: HeaderCol[] = [
  { id: 'page_title', key: 'title', title: 'Título', type: 'text' },
  { id: 'done', title: 'Concluído', type: 'checkbox' },
  { id: 'date', title: 'Data', type: 'date' },
]
const rows: RowData[] = [
  { id: 'checked', cells: { done: { value: true } } },
  { id: 'unchecked', cells: { done: { value: false } } },
  { id: 'missing', cells: {} },
  { id: 'null', cells: { done: { value: null } } },
].map((row, index) => ({
  ...row,
  cells: {
    ...row.cells,
    page_title: { value: `Registro ${row.id}` },
    date: { value: `2026-10-0${index + 3}T00:00:00.000Z` },
  },
}))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CubsDatabase — filtro de checkbox em todas as visualizações de registros', () => {
  it.each(['table', 'grid', 'calendar', 'graph'] as const)(
    '%s inclui vazios em Não e mantém filtros próprios ao trocar de aba',
    (view) => {
      const settings: DataViewSettings = Object.fromEntries(
        [['pending', 'Pendentes', 'false'], ['done', 'Concluídos', 'true']].map(([id, name, value]) => [
          id,
          {
            view,
            name,
            urlKey: { key: id, aliases: [] },
            orderedHeaderCols: columns.map(({ id: columnId }) => columnId),
            dateColumnId: 'date',
            filters: {
              ...emptyViewFilters(),
              clauses: [{ columnId: 'done', condition: 'equals', values: [value] }],
            },
          },
        ]),
      )
      render(<CubsDatabase settings={settings} headerCols={columns} rows={rows} />)

      const assertRows = (expected: string[]) => {
        for (const { id } of rows) {
          expect(screen.queryAllByText(`Registro ${id}`).length > 0).toBe(expected.includes(id))
        }
      }
      assertRows(['unchecked', 'missing', 'null'])
      fireEvent.click(screen.getByText('Concluídos'))
      assertRows(['checked'])
      fireEvent.click(screen.getByText('Pendentes'))
      assertRows(['unchecked', 'missing', 'null'])
    },
    15_000,
  )
})
