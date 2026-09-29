import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarView } from './CalendarView'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-28T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('CalendarView', () => {
  it('keeps month context and navigation without schedule mode tabs', () => {
    render(<CalendarView
      columns={[{ id: 'title', key: 'title', title: 'Nome', type: 'text' }, { id: 'date', title: 'Data', type: 'date' }]}
      rows={[{ id: 'page-1', cells: { title: { value: 'Entrega' }, date: { value: '2026-09-12' } } }]}
    />)

    expect(screen.getByRole('heading', { name: 'setembro' })).not.toBeNull()
    const year = screen.getByRole('button', { name: 'Selecionar ano' })
    expect(year.textContent).toContain('2026')
    expect(year.className).toContain('font-medium')
    expect(year.className).not.toContain('font-semibold')
    expect(screen.queryByRole('tablist')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Próximo mês' }))
    expect(screen.getByRole('heading', { name: 'outubro' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }))
    expect(screen.getByRole('heading', { name: 'setembro' })).not.toBeNull()
  })

  it('opens details before navigation and keeps pinning behind explicit actions', () => {
    const onOpenRow = vi.fn()
    const onPin = vi.fn()
    render(<CalendarView
      columns={[{ id: 'title', key: 'title', title: 'Nome', type: 'text' }, { id: 'date', title: 'Data', type: 'date' }, { id: 'status', title: 'Status', type: 'select', options: [{ id: 'doing', label: 'Em andamento', color: 'blue' }] }]}
      rows={[{ id: 'page-1', cells: { title: { value: 'Entrega' }, date: { value: '2026-09-28T00:00:00.000Z' }, status: { value: 'doing' } } }]}
      onOpenRow={onOpenRow}
      onPin={onPin}
    />)

    const propertyLabel = screen.getByText('Status:')
    const propertyArea = propertyLabel.closest('[data-calendar-properties]')
    expect(propertyArea?.className).toContain('flex-col')
    expect(propertyArea?.className).toContain('justify-start')
    expect(propertyLabel.parentElement?.textContent).toContain('Em andamento')
    fireEvent.click(screen.getByRole('button', { name: 'Entrega' }))
    expect(screen.getByRole('dialog', { name: 'Entrega' })).not.toBeNull()
    expect(onOpenRow).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Fixar na agenda' }))
    expect(onPin).toHaveBeenCalledWith({ pageId: 'page-1', dateColumnId: 'date', colorColumnId: 'status' })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir página' }))
    expect(onOpenRow).toHaveBeenCalledWith(expect.objectContaining({ id: 'page-1' }))
  })

  it('guides the user when the database has no date property', () => {
    render(<CalendarView columns={[{ id: 'title', key: 'title', title: 'Nome', type: 'text' }]} rows={[]} />)
    expect(screen.getByText(/Adicione uma propriedade de data/)).not.toBeNull()
  })

  it('hides every property label from the database view with one global option', () => {
    render(<CalendarView
      columns={[
        { id: 'title', key: 'title', title: 'Nome', type: 'text' },
        { id: 'date', title: 'Data', type: 'date' },
        { id: 'status', title: 'Status', type: 'select', options: [{ id: 'doing', label: 'Em andamento', color: 'blue' }] },
      ]}
      rows={[{ id: 'page-1', cells: { title: { value: 'Entrega' }, date: { value: '2026-09-28T00:00:00.000Z' }, status: { value: 'doing' } } }]}
      showPropertyLabels={false}
    />)

    expect(screen.getByText('Status:').className).toContain('sr-only')
    expect(screen.getByText('Em andamento')).not.toBeNull()
  })
})
