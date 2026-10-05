import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { BoardViewConfig, HeaderCol } from '../types'
import { BoardView } from './BoardView'

const columns: HeaderCol[] = [{
  id: '01KXVZ00000000000000000001', title: 'Status', type: 'select',
  options: [{ id: '01KXVZ00000000000000000002', label: 'Board', color: 'blue' }],
}]

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('conclui o recolhimento e a expansão sem transição quando o usuário reduz movimento', async () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(prefers-reduced-motion)', media: query, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
  vi.useFakeTimers()
  function Example() {
    const [config, setConfig] = useState<BoardViewConfig>({})
    return <BoardView columns={columns} rows={[]} config={config} onConfigChange={(patch) => setConfig((previous) => ({ ...previous, ...patch }))} />
  }
  const { container } = render(<Example />)
  const board = container.querySelector('[data-board-column]') as HTMLElement
  expect(board.style.width).toBe('320px')
  fireEvent.click(screen.getByRole('button', { name: 'Recolher Board' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(32) })
  expect(board.style.width).toBe('48px')
  fireEvent.click(screen.getByRole('button', { name: 'Expandir Board' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(32) })
  expect(board.style.width).toBe('320px')
})
