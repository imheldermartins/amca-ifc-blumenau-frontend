import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Tooltip } from './Tooltip'

afterEach(() => cleanup())

describe('Tooltip', () => {
  it('expõe a descrição completa por foco de teclado', async () => {
    render(
      <Tooltip content="Nome completo da coluna" delayDuration={0}>
        <button type="button">Nome…</button>
      </Tooltip>,
    )

    fireEvent.focus(screen.getByRole('button', { name: 'Nome…' }))

    await waitFor(() => {
      expect(screen.getByRole('tooltip').textContent).toContain('Nome completo da coluna')
    })
  })

  it('não cria superfície quando o conteúdo está vazio', () => {
    render(
      <Tooltip content="">
        <button type="button">Sem dica</button>
      </Tooltip>,
    )

    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
