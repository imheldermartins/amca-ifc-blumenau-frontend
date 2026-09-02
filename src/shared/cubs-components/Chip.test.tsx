import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Chip } from './Chip'

afterEach(() => cleanup())

describe('Chip', () => {
  it('é informativo sem ação e removível quando o domínio fornece callback', () => {
    const onRemove = vi.fn()
    const { rerender } = render(<Chip>Ativo</Chip>)

    expect(screen.getByText('Ativo')).not.toBeNull()
    expect(screen.queryByRole('button')).toBeNull()

    rerender(
      <Chip onRemove={onRemove} removeLabel="Remover Ativo">
        Ativo
      </Chip>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remover Ativo' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })
})
