import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatabaseViewSyncStatus } from './DatabaseViewSyncStatus'

afterEach(() => cleanup())

describe('DatabaseViewSyncStatus', () => {
  it.each(['confirmed', 'pending', 'saving'] as const)('expõe o estado %s', (state) => {
    render(<DatabaseViewSyncStatus status={{ state, label: `Estado ${state}` }} />)

    expect(screen.getByRole('status').dataset.filterSyncState).toBe(state)
  })

  it('permite adotar pending e repetir erro sem assumir a operação', () => {
    const adopt = vi.fn()
    const { rerender } = render(
      <DatabaseViewSyncStatus
        status={{
          state: 'pending',
          label: 'Filtros alterados há 2 min',
          actionLabel: 'Atualizar',
          onAction: adopt,
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(adopt).toHaveBeenCalledOnce()

    rerender(
      <DatabaseViewSyncStatus
        status={{ state: 'error', label: 'Falha ao salvar', actionLabel: 'Tentar novamente' }}
      />,
    )
    expect(screen.getByRole('alert').dataset.filterSyncState).toBe('error')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
