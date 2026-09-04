import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TableViewProps } from './components/TableView'

const tableViewSpy = vi.hoisted(() => vi.fn((_props: TableViewProps) => null))

vi.mock('./components/TableView', () => ({ TableView: tableViewSpy }))

import { CubsDatabase } from './CubsDatabase'
import type { DataViewSettings, HeaderCol, RowData, ViewFiltersV2 } from './types'

const VIEW_ID = '01KXVZ0000VIEW00000000001'
const COLUMNS: HeaderCol[] = [
  { id: 'name', key: 'title', title: 'Nome', type: 'text' },
  { id: 'area', title: 'Area', type: 'text' },
]
const ROWS: RowData[] = [
  { id: 'row-1', cells: { name: { value: 'Ana' }, area: { value: 'Produto' } } },
]

function filters(updatedAt: string, groupBy: string[] = ['area']): ViewFiltersV2 {
  return {
    version: 2,
    updatedAt,
    clauses: [],
    groupBy,
    passthrough: [],
  }
}

function settings(document: ViewFiltersV2): DataViewSettings {
  return {
    [VIEW_ID]: {
      view: 'table',
      name: 'Tabela',
      urlKey: { key: 'tabela', aliases: [] },
      filters: document,
      title: {
        key: 'title',
        column_name: 'Nome',
        publicKey: { key: 'nome', aliases: [] },
      },
      orderedHeaderCols: ['name', 'area'],
      orderedRows: ['row-1'],
      columnWidths: { name: 240, area: 180 },
    },
  }
}

afterEach(() => {
  cleanup()
  tableViewSpy.mockClear()
})

describe('CubsDatabase - estabilidade durante confirmacao de agrupamentos', () => {
  it('nao reapresenta a tabela inteira no HTTP e no eco realtime do mesmo documento', () => {
    const initialFilters = filters('2026-09-03T10:00:00.000Z')
    const { rerender } = render(
      <CubsDatabase
        settings={settings(initialFilters)}
        headerCols={COLUMNS}
        rows={ROWS}
        filtersOverride={initialFilters}
      />,
    )
    const initialProps = tableViewSpy.mock.lastCall?.[0]
    expect(initialProps).toBeDefined()

    const confirmedFilters = filters('2026-09-03T10:00:01.000Z')
    rerender(
      <CubsDatabase
        settings={settings(confirmedFilters)}
        headerCols={COLUMNS}
        rows={ROWS}
        filtersOverride={confirmedFilters}
      />,
    )
    const confirmedProps = tableViewSpy.mock.lastCall?.[0]

    expect(confirmedProps?.rows).toBe(initialProps?.rows)
    expect(confirmedProps?.columns).toBe(initialProps?.columns)
    expect(confirmedProps?.groupBy).toBe(initialProps?.groupBy)
    expect(confirmedProps?.columnWidths).toBe(initialProps?.columnWidths)

    const echoedFilters = filters('2026-09-03T10:00:02.000Z')
    rerender(
      <CubsDatabase
        settings={settings(echoedFilters)}
        headerCols={COLUMNS}
        rows={ROWS}
        filtersOverride={echoedFilters}
      />,
    )
    const echoedProps = tableViewSpy.mock.lastCall?.[0]

    expect(echoedProps?.rows).toBe(initialProps?.rows)
    expect(echoedProps?.columns).toBe(initialProps?.columns)
    expect(echoedProps?.groupBy).toBe(initialProps?.groupBy)
    expect(echoedProps?.columnWidths).toBe(initialProps?.columnWidths)
  })

  it('ainda recalcula a tabela quando o agrupamento realmente muda', () => {
    const initialFilters = filters('2026-09-03T10:00:00.000Z')
    const { rerender } = render(
      <CubsDatabase
        settings={settings(initialFilters)}
        headerCols={COLUMNS}
        rows={ROWS}
        filtersOverride={initialFilters}
      />,
    )
    const initialProps = tableViewSpy.mock.lastCall?.[0]

    const changedFilters = filters('2026-09-03T10:00:01.000Z', [])
    rerender(
      <CubsDatabase
        settings={settings(changedFilters)}
        headerCols={COLUMNS}
        rows={ROWS}
        filtersOverride={changedFilters}
      />,
    )
    const changedProps = tableViewSpy.mock.lastCall?.[0]

    expect(changedProps?.groupBy).not.toBe(initialProps?.groupBy)
    expect(changedProps?.groupBy).toEqual([])
  })
})
