import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Menu } from './Menu'

afterEach(() => cleanup())

describe('Menu', () => {
  it('monta ações a partir de um array e mantém o tratamento visual compartilhado', () => {
    const onSelect = vi.fn()

    const { container } = render(
      <Menu items={[{ id: 'rename', name: 'Renomear', icon: 'lucide:pencil', onSelect }]} />,
    )

    const action = screen.getByRole('menuitem', { name: 'Renomear' })
    action.click()

    expect(onSelect).toHaveBeenCalledOnce()
    expect(action.className).toContain('glow-purple-hover')
    expect(container.firstElementChild?.className).toContain('backdrop-blur-2xl')
  })
})
