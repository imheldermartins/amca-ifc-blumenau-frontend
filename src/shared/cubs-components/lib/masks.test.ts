import { describe, expect, it } from 'vitest'

import { applyMask } from './masks'

describe('applyMask — email', () => {
  it('preserva letras e pontuação em vez de aplicar unmask numérico', () => {
    expect(applyMask('email', 'Pessoa.Teste+agenda@example.com'))
      .toBe('Pessoa.Teste+agenda@example.com')
  })
})
