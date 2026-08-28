import { render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Checkbox } from './Checkbox'

afterEach(() => cleanup())

describe('Checkbox', () => {
  it('mantém a caixa totalmente circular nos estados vazio e marcado', () => {
    const { rerender } = render(
      <Checkbox aria-label="Selecionar" checked={false} onCheckedChange={() => undefined} />,
    )

    expect(screen.getByRole('checkbox').className).toContain('rounded-full')

    rerender(
      <Checkbox aria-label="Selecionar" checked onCheckedChange={() => undefined} />,
    )

    expect(screen.getByRole('checkbox').className).toContain('rounded-full')
  })
})
