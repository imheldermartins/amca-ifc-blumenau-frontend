import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dock, dockVisibleCount } from './Dock'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('Dock', () => {
  it('animates neighboring icons by pointer proximity only on desktop and respects reduced motion', async () => {
    let desktop = true, reduced = false
    const listeners = new Set<() => void>()
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() { return query.includes('prefers-reduced-motion') ? reduced : desktop },
      addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    }))
    render(<Dock label="Ações" items={Array.from({ length: 3 }, (_, index) => ({ name: `Item ${index}`, icon: 'lucide:box', action: vi.fn() }))} />)
    const toolbar = screen.getByRole('toolbar')
    const buttons = screen.getAllByRole('button')
    buttons.forEach((button, index) => vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(new DOMRect(index * 44, 0, 40, 40)))
    expect(toolbar.getAttribute('data-dock-animation')).toBe('proximity')
    fireEvent(toolbar, new MouseEvent('pointermove', { bubbles: true, clientX: 20 }))
    const scale = (index: number) => Number(/scale\(([^)]+)\)/.exec(buttons[index]!.querySelector<HTMLElement>('[data-dock-icon]')!.style.transform)?.[1] ?? 1)
    await waitFor(() => { expect(scale(0)).toBeGreaterThan(1.2); expect(scale(1)).toBeGreaterThan(1.05); expect(scale(0)).toBeGreaterThan(scale(1)) })
    act(() => { reduced = true; listeners.forEach((listener) => listener()) })
    expect(toolbar.getAttribute('data-dock-animation')).toBe('none')
    act(() => { reduced = false; desktop = false; listeners.forEach((listener) => listener()) })
    expect(toolbar.getAttribute('data-dock-animation')).toBe('none')
  })
  it('invokes native name/icon/action items and opens More when space runs out', () => {
    const action = vi.fn(), more = vi.fn()
    render(<Dock label="Ações" items={Array.from({ length: 20 }, (_, index) => ({ name: `Item ${index}`, icon: 'lucide:box', action }))}
      more={{ name: 'Mais', icon: 'lucide:ellipsis', action: more }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Item 0' }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Item 19' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))
    expect(more).toHaveBeenCalledOnce()
  })
  it('fits all actions on wide surfaces and reserves More on small surfaces', () => {
    expect(dockVisibleCount(8, 1200)).toBe(8)
    expect(dockVisibleCount(8, 400)).toBe(8)
    expect(dockVisibleCount(8, 120)).toBe(1)
    expect(dockVisibleCount(6, 280)).toBe(6)
    expect(dockVisibleCount(6, 280, [3])).toBe(4)
  })
})
