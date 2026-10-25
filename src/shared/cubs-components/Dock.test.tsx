import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dock, dockVisibleCount } from './Dock'

afterEach(cleanup)
describe('Dock', () => {
  it('invokes native name/icon/action items and opens More when space runs out', () => {
    const action = vi.fn(), more = vi.fn()
    render(<Dock label="Ações" items={Array.from({ length: 12 }, (_, index) => ({ name: `Item ${index}`, icon: 'lucide:box', action }))}
      more={{ name: 'Mais', icon: 'lucide:ellipsis', action: more }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Item 0' }))
    expect(action).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: 'Item 11' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mais' }))
    expect(more).toHaveBeenCalledOnce()
  })
  it('fits all actions on wide surfaces and reserves More on small surfaces', () => {
    expect(dockVisibleCount(8, 1200)).toBe(8)
    expect(dockVisibleCount(8, 400)).toBe(4)
    expect(dockVisibleCount(8, 120)).toBe(0)
  })
})
