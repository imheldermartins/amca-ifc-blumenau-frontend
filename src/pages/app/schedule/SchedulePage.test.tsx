import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SchedulePreviewPage } from './SchedulePage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-27T12:00:00Z'))
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({ matches: query.includes('min-width') || query.includes('prefers-reduced-motion'), media: query, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('schedule mockup', () => {
  it('uses one collapse action, card pins, and confirmation before unpinning', async () => {
    render(<SchedulePreviewPage />)
    expect(screen.getAllByRole('button', { name: 'Recolher lateral' })).toHaveLength(1)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByText('Próximos itens')).toBeNull()
    const pin = screen.getByRole('button', { name: 'Desafixar Design do calendário' })
    expect(pin.closest('[data-pinned-page-card="page-7"]')).not.toBeNull()
    expect(pin.closest('article')?.className).toContain('p-3')
    fireEvent.click(pin)
    expect(screen.getByRole('dialog', { name: 'Desafixar do calendário?' }).textContent).toContain('continuará disponível')
    expect(document.querySelector('[data-calendar-item="page-7"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Desafixar Design do calendário' })).not.toBeNull()
    fireEvent.click(pin)
    fireEvent.click(screen.getByRole('button', { name: 'Desafixar' }))
    await waitFor(() => expect(document.querySelector('[data-calendar-item="page-7"]')).toBeNull())
    expect(screen.queryByRole('button', { name: 'Desafixar Design do calendário' })).toBeNull()
  })

  it('retains the focal date across modes and keeps an unpinned page available to pin again', async () => {
    render(<SchedulePreviewPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Dia' }))
    await waitFor(() => expect(document.querySelector('[data-calendar-mode="day"]')).not.toBeNull())
    const calendar = within(screen.getByRole('tabpanel')).getByRole('region', { name: 'Calendário' })
    await waitFor(() => expect(calendar.querySelector('[data-calendar-scroll]')).not.toBeNull())
    const item = await within(calendar).findByRole('button', { name: 'Design do calendário' })
    fireEvent.click(item)
    expect(screen.getByRole('dialog', { name: 'Design do calendário' })).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Desafixar página' }))
    fireEvent.click(screen.getByRole('button', { name: 'Desafixar' }))
    await waitFor(() => expect(document.querySelector('[data-calendar-item="page-7"]')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Fixar página' }))
    expect(document.querySelector('[data-calendar-item="page-7"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar detalhes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Recolher lateral', pressed: true }))
    expect(screen.queryByRole('complementary')).toBeNull()
  })

  it('keeps week and day charts compact without rendering item properties', async () => {
    render(<SchedulePreviewPage />)
    const calendar = within(screen.getByRole('tabpanel')).getByRole('region', { name: 'Calendário' })
    expect(calendar.querySelector('[data-calendar-item="page-7"]')?.textContent).toContain('Projeto')

    fireEvent.click(screen.getByRole('tab', { name: 'Semana' }))
    await waitFor(() => expect(document.querySelector('[data-calendar-mode="week"]')).not.toBeNull())
    expect(calendar.querySelector('[data-calendar-item="page-7"]')?.textContent).toBe('09:00 · Design do calendário')
    expect(calendar.querySelector('[data-calendar-item="external-focus"]')?.textContent).toBe('13:00 · Tempo de foco')

    fireEvent.click(screen.getByRole('tab', { name: 'Dia' }))
    await waitFor(() => expect(document.querySelector('[data-calendar-mode="day"]')).not.toBeNull())
    expect(calendar.querySelector('[data-calendar-item="page-7"]')?.textContent).toBe('09:00 · Design do calendário')
    expect(calendar.querySelector('[data-calendar-item="external-focus"]')?.textContent).toBe('13:00 · Tempo de foco')
  })

  it('defaults to the first select property and uses its ULID to change the color source', async () => {
    render(<SchedulePreviewPage />)
    const getEvent = () => document.querySelector('[data-calendar-item="page-8"]')
    expect(getEvent()?.className).toContain('bg-p-blue-600/15')
    fireEvent.click(within(screen.getByRole('complementary')).getByRole('button', { name: /^Revisão de componentes/ }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Cor pela propriedade' }))
    expect(screen.queryByRole('option', { name: 'Roxo padrão' })).toBeNull()
    fireEvent.click(await screen.findByRole('option', { name: 'Prioridade' }))
    expect(getEvent()?.className).toContain('bg-p-orange-600/15')
  })

  it('selects a distant year through the scrollable keyboard list', async () => {
    render(<SchedulePreviewPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar ano' }))
    const list = screen.getByRole('listbox', { name: 'Ano' })
    fireEvent.keyDown(list, { key: 'End' })
    fireEvent.keyDown(list, { key: 'Enter' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Selecionar ano' }).textContent).toContain('9999'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
