import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './Button'

afterEach(() => cleanup())

describe('Button', () => {
  it('restringe o glow ao filled roxo e mantém o text red sem glow', () => {
    const { rerender } = render(<Button>Continuar</Button>)

    expect(screen.getByRole('button').className).toContain('glow-purple-hover')

    rerender(
      <Button variant="text" color="red">
        Fechar
      </Button>,
    )

    expect(screen.getByRole('button').className).not.toContain('glow-purple-hover')
    expect(screen.getByRole('button').className).toContain('text-p-red')
  })
})
