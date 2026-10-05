import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BoardView } from './BoardView'
import type { HeaderCol, RowData } from '../types'

const renders = vi.hoisted(() => ({ cards: new Map<string, number>(), columns: [] as string[], addButtons: 0 }))
vi.mock('../calendarItems', async (original) => {
  const module = await original<typeof import('../calendarItems')>()
  return { ...module, databaseCardProperties: (...args: Parameters<typeof module.databaseCardProperties>) => {
    renders.cards.set(args[0].id, (renders.cards.get(args[0].id) ?? 0) + 1)
    return module.databaseCardProperties(...args)
  } }
})
vi.mock('cubs-components', async (original) => {
  const module = await original<typeof import('cubs-components')>()
  return { ...module, cn: (...args: Parameters<typeof module.cn>) => {
    if (typeof args[0] === 'string' && args[0].startsWith('flex min-h-64')) renders.columns.push(String(args[1]))
    if (typeof args[0] === 'string' && args[0].startsWith('m-2 mt-0')) renders.addButtons++
    return module.cn(...args)
  } }
})

const SELECT = '01KXVZ00000000000000000001', FIRST = '01KXVZ00000000000000000002', SECOND = '01KXVZ00000000000000000003'
const columns: HeaderCol[] = [
  { id: 'title', key: 'title', title: 'Nome', type: 'text' },
  { id: SELECT, title: 'Status', type: 'select', options: [{ id: FIRST, label: 'Primeiro', color: 'blue' }, { id: SECOND, label: 'Segundo', color: 'orange' }] },
]
const rows: RowData[] = Array.from({ length: 1000 }, (_, index) => ({
  id: `row-${index}`, cells: { title: { value: `Página ${index}` }, [SELECT]: { value: index < 500 ? FIRST : SECOND } },
}))

afterEach(() => { cleanup(); vi.restoreAllMocks(); renders.cards.clear(); renders.columns.length = 0; renders.addButtons = 0 })

it('isolates visual renders from real dnd-kit context updates in a Board with 1000 cards', async () => {
  // jsdom has no layout. Supply positions for the actual sensor, collision
  // detection and sortable context; the dnd-kit components/hooks stay real.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const card = this.matches('[data-board-card]') ? this : this.querySelector('[data-board-card]')
    const board = this.matches('[data-board-column]') ? this : this.closest('[data-board-column]') ?? this.querySelector('[data-board-column]')
    const x = board?.getAttribute('data-board-column') === SECOND ? 332 : 0
    if (card) {
      const index = Number(card.getAttribute('data-board-card')!.slice(4)) % 500
      return new DOMRect(x + 9, 50 + index * 70, 302, 60)
    }
    return new DOMRect(x, 0, 320, 36000)
  })
  const move = vi.fn(async () => undefined)
  const { container } = render(<BoardView columns={columns} rows={rows} config={{ propertyIds: [] }} onMove={move} onCellChange={vi.fn()} onCreateRow={vi.fn()} onConfigChange={vi.fn()} />)
  expect(renders.cards.size).toBe(1000)
  const buttons = [...container.querySelectorAll('button')].filter((button) => button.textContent === 'Adicionar card')
  renders.cards.clear(); renders.columns.length = 0; renders.addButtons = 0
  const handle = screen.getByRole('button', { name: 'Arrastar Página 0' })
  fireEvent.keyDown(handle, { key: ' ', code: 'Space' })
  await waitFor(() => expect(container.querySelector('[data-drag-placeholder]')).toBeTruthy())
  // The sensor attaches its keyboard listener after activation.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  for (let index = 0; index < 8; index++) {
    fireEvent.keyDown(document, { key: 'ArrowDown', code: 'ArrowDown' })
    await act(async () => { await Promise.resolve() })
  }
  const placeholder = container.querySelector(`[data-board-column="${FIRST}"] [data-drag-placeholder]`)
  expect(placeholder?.parentElement?.parentElement?.previousElementSibling).toBeTruthy()
  expect(renders.cards.size).toBe(1)
  expect(renders.cards.has('row-0')).toBe(true)
  expect(renders.columns).not.toContain('bg-p-orange-500/10')
  expect(renders.addButtons).toBe(0)
  expect(buttons.every((button) => button.isConnected)).toBe(true)
  fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
  await waitFor(() => expect(container.querySelector('[data-drag-placeholder]')).toBeNull())
  expect(move).not.toHaveBeenCalled()
}, 30000)
