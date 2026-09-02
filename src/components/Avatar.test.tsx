import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Avatar } from './Avatar'

afterEach(() => cleanup())

describe('Avatar', () => {
  it('renderiza a projeção visual recebida do utilitário', () => {
    render(<Avatar slug="HX" color="green" label="Helder Xavier" active />)

    const avatar = screen.getByRole('img', { name: 'Helder Xavier' })
    expect(avatar.textContent).toBe('HX')
    expect(avatar.className).toContain('bg-p-green-500')
    expect(avatar.className).toContain('outline-p-purple-500')
  })
})
