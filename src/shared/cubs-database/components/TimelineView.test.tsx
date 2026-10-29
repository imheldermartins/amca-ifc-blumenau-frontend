import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimelineView } from './TimelineView'
import { timelineBar, timelineItems, timelinePeriod } from '../timeline'
import type { HeaderCol, RowData } from '../types'
import type { DatabasePagination } from '../pagination'
import { ViewSettingsForm } from './ViewSettingsForm'
import { DEFAULT_VIEW_MOCK_SETTINGS } from '../viewSettings'
import { CubsDatabase } from '../CubsDatabase'
import { emptyViewFilters } from '../viewFilters'

afterEach(cleanup)
const columns: HeaderCol[] = [
  {id: 'title', key: 'title', title: 'Nome', type: 'text'},
  {id: 'date', title: 'Entrega', type: 'date'},
  {id: 'other', title: 'Outra data', type: 'date'},
  {id: 'status', title: 'Status', type: 'select', options: [{id: 'doing', label: 'Fazendo', color: 'blue'}]},
]
const iso = (day: number) => `2026-10-${String(day).padStart(2, '0')}T00:00:00.000Z`
const row = (value: string): RowData => ({id: 'a', cells: {title: {value: 'Entrega A'}, date: {value}, status: {value: 'doing'}}})

describe('Timeline', () => {
  it('routes editing through the shared host with the view, parent and chosen date', () => {
    const onRequestEditRow = vi.fn()
    render(<CubsDatabase pageId="parent" headerCols={columns} rows={[row(iso(5))]} onRequestEditRow={onRequestEditRow}
      settings={{timeline: {view: 'timeline', name: 'Cronograma', orderedHeaderCols: [], filters: emptyViewFilters(), dateColumnId: 'date', urlKey: {key: 'timeline', aliases: []}}}} />)
    fireEvent.click(screen.getByRole('button', {name: 'Editar Entrega A'}))
    expect(onRequestEditRow).toHaveBeenCalledWith({viewType: 'timeline', viewId: 'timeline', rowId: 'a', parentPageId: 'parent', dateColumnId: 'date'})
  })
  it('projects dates inclusively and uses default or explicitly selected colors', () => {
    const [simple] = timelineItems([row(iso(5))], columns)
    expect(simple.end).toBe(iso(6))
    expect(simple.color).toBe('purple')
    expect(timelineItems([row(iso(5))], columns, 'date', null)[0].color).toBe('purple')
    expect(timelineItems([row(`${iso(5)}@${iso(8)}`)], columns, 'date', 'status')[0]).toMatchObject({end: iso(9), color: 'blue'})
    expect(timelineItems([row(iso(5))], columns, 'date', 'removed')[0].color).toBe('purple')
    expect(timelineItems([row('invalid')], columns)).toEqual([])
    expect(timelineItems([row(iso(5))], columns, 'status')).toEqual([])
    expect(timelineItems([row(`${iso(8)}@${iso(5)}`)], columns)).toEqual([])
    expect(timelineItems([row(`${iso(6)}@${iso(5)}`)], columns)).toEqual([])
  })
  it('clips intersecting ranges and preserves hours', () => {
    const period = timelinePeriod('2026-10-07', 'week')
    expect(period.from).toBe('2026-10-05')
    expect(period.to).toBe('2026-10-11')
    expect(timelineBar(Date.parse(iso(1)), Date.parse(iso(8)), period, 40)).toEqual({left: 0, width: 120})
    expect(timelineBar(Date.parse(iso(12)), Date.parse(iso(13)), period, 40)).toBeNull()
    const [item] = timelineItems([row('2026-10-05T12:00:00.000Z@2026-10-05T18:00:00.000Z')], columns)
    expect(timelineBar(item.startMs, item.endMs, period, 40)).toEqual({left: 20, width: 10})
  })
  it('navigates, changes scale and edits the original row', () => {
    const onEditRow = vi.fn()
    const data = row(iso(5))
    const {container, rerender} = render(<TimelineView columns={columns} rows={[data]} onEditRow={onEditRow} />)
    expect(screen.getByRole('heading').textContent).toContain('outubro de 2026')
    fireEvent.click(screen.getByRole('button', {name: 'Editar Entrega A'}))
    expect(onEditRow).toHaveBeenCalledWith(data, 'date')
    expect(container.querySelector('[data-timeline-bar]')?.getAttribute('data-color')).toBe('purple')
    rerender(<TimelineView columns={columns} rows={[data]} colorColumnId="status" onEditRow={onEditRow} />)
    expect(container.querySelector('[data-timeline-bar]')?.getAttribute('data-color')).toBe('blue')
    fireEvent.click(screen.getByRole('button', {name: 'Próximo período'}))
    expect(screen.getByRole('heading').textContent).toContain('novembro')
    expect(screen.getByText('Nenhuma página com data neste período.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Semana'}))
    expect(screen.getByRole('button', {name: 'Semana'}).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', {name: 'Hoje'}))
    expect(screen.getByRole('heading').textContent).toContain(new Date().getFullYear().toString())
  })
  it('requests the visible period from the pagination bridge', () => {
    const pagination: DatabasePagination = {projection: {initialDate: '2026-10-05'} as DatabasePagination['projection'], streams: {}, setScope: vi.fn(), ensureScope: vi.fn(), loadNext: vi.fn(), loadPrevious: vi.fn(), loading: false}
    render(<TimelineView columns={columns} rows={[]} pagination={pagination} />)
    expect(pagination.setScope).toHaveBeenCalledWith({type: 'calendar', from: '2026-10-01', to: '2026-10-31'})
    fireEvent.click(screen.getByRole('button', {name: 'Próximo período'}))
    expect(pagination.setScope).toHaveBeenLastCalledWith({type: 'calendar', from: '2026-11-01', to: '2026-11-30'})
  })
  it('guides configuration when no Date exists', () => {
    render(<TimelineView columns={[columns[0]]} rows={[]} />)
    expect(screen.getByText(/Adicione uma propriedade de data/)).toBeTruthy()
  })
  it('offers only Date columns for dates and Select columns for color', async () => {
    const onCalendarChange = vi.fn()
    render(<ViewSettingsForm type="timeline" columns={columns} settings={DEFAULT_VIEW_MOCK_SETTINGS} onChange={vi.fn()} onCalendarChange={onCalendarChange} />)
    fireEvent.click(screen.getByRole('combobox', {name: 'Propriedade de data'}))
    expect(screen.queryByRole('option', {name: 'Status'})).toBeNull()
    fireEvent.click(await screen.findByRole('option', {name: 'Outra data'}))
    expect(onCalendarChange).toHaveBeenLastCalledWith({dateColumnId: 'other'})
    fireEvent.click(screen.getByRole('combobox', {name: 'Propriedade de cor'}))
    expect(screen.queryByRole('option', {name: 'Outra data'})).toBeNull()
    fireEvent.click(await screen.findByRole('option', {name: 'Status'}))
    expect(onCalendarChange).toHaveBeenLastCalledWith({colorColumnId: 'status'})
  })
})
