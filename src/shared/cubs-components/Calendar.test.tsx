import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Calendar } from './Calendar'
import { CalendarDetailsDialog } from './CalendarDetailsDialog'
import type { CalendarItem } from './calendar/types'

afterEach(() => { cleanup(); vi.useRealTimers() })

describe('calendar interaction', () => {
  it('provides a controlled, accessible details dialog without app dependencies', () => {
    const onOpenChange = vi.fn()
    const item: CalendarItem = { id: 'page-1', type: 'page', title: 'Entrega', start: '2026-09-28', allDay: true, data: { page: { id: 'page-1', title: 'Entrega' }, properties: [{ id: 'status', label: 'Status', value: 'Em andamento' }] } }
    render(<CalendarDetailsDialog item={item} onOpenChange={onOpenChange} source="Projetos" renderActions={() => <button type="button">Fixar na agenda</button>} />)
    expect(screen.getByRole('dialog', { name: 'Entrega' }).textContent).toContain('Projetos')
    expect(screen.getByRole('button', { name: 'Fixar na agenda' })).not.toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('works without app providers, renders external recursive payloads, and uses narrow weekday labels', () => {
    const items: CalendarItem<{ external: { label: string } }>[] = [{ id: 'root', type: 'external', title: 'External', start: '2026-09-02', allDay: true, data: { label: 'Parent payload' }, children: [
      { id: 'child', type: 'external', title: 'Nested', start: '2026-09-03', allDay: true, data: { label: 'Child payload' } },
    ] }]
    render(<Calendar items={items} date="2026-09-02" renderers={{ external: (data) => data.label }} />)
    expect(screen.getByText('Parent payload')).not.toBeNull()
    expect(screen.getByText('Child payload')).not.toBeNull()
    const labels = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'].map((name) => screen.getByTitle(name).textContent)
    expect(labels).toEqual(['D', 'S', 'T', 'Q', 'Q', 'S', 'S'])
    const event = screen.getByRole('button', { name: 'External' })
    expect(event.className).not.toContain('border-l')
    expect(event.className).toContain('backdrop-blur-sm')
    expect(event.className).toContain('border-p-purple-600/40')
    expect(event.className).toContain('shadow-p-purple-600/20')
  })
  it('advances one month per wheel gesture and preserves browser zoom', () => {
    const onDateChange = vi.fn()
    render(<Calendar items={[]} date="2026-12-15" onDateChange={onDateChange} />)
    const region = screen.getByRole('region')
    fireEvent.wheel(region, { deltaY: 100 })
    fireEvent.wheel(region, { deltaY: 100 })
    fireEvent.wheel(region, { deltaY: 100, ctrlKey: true })
    expect(onDateChange).toHaveBeenCalledTimes(1)
    expect(onDateChange).toHaveBeenCalledWith('2027-01-15')
  })

  it('does not turn a time-grid scroll into date navigation', () => {
    const onDateChange = vi.fn()
    render(<Calendar items={[]} date="2026-09-27" mode="week" onDateChange={onDateChange} />)
    fireEvent.wheel(screen.getByRole('region'), { deltaY: 400 })
    expect(onDateChange).not.toHaveBeenCalled()
  })

  it('highlights the full current-day surface in month and time grids', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'))
    const { rerender } = render(<Calendar items={[]} date="2026-09-28" />)
    expect(document.querySelector('[data-calendar-today]')?.className).toContain('bg-p-purple/5')
    rerender(<Calendar items={[]} date="2026-09-28" mode="week" />)
    expect(document.querySelector('[data-calendar-today]')?.className).toContain('bg-p-purple/5')
  })

  it('keeps overflow items available in a popover and opens the original payload', async () => {
    const onItemClick = vi.fn()
    const items: CalendarItem[] = Array.from({ length: 6 }, (_, index) => ({ id: String(index), title: `Item ${index}`, start: '2026-09-02', allDay: true, type: 'item', data: {} }))
    render(<Calendar items={items} date="2026-09-02" onItemClick={onItemClick} />)
    fireEvent.click(screen.getByRole('button', { name: '+3 itens' }))
    const hidden = await screen.findByRole('button', { name: 'Item 5' })
    fireEvent.click(hidden)
    await waitFor(() => expect(onItemClick).toHaveBeenCalledWith(items[5]))
  })
})
