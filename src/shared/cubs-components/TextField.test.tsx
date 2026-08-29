import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TextField } from './TextField'

afterEach(() => cleanup())

describe('TextField — cor de erro por superfície', () => {
  it('permite sobrescrever mensagem e input depois da paleta padrão', () => {
    render(
      <TextField
        label="E-mail"
        value="inválido"
        onChange={() => undefined}
        errorMessage="E-mail inválido"
        inputClassName="border-light-500"
        errorClassName="text-p-red-300"
        errorInputClassName="border-p-red-300 focus-visible:ring-p-red-300/30"
      />,
    )

    expect(screen.getByRole('alert').className).toContain('text-p-red-300')
    expect(screen.getByRole('alert').className).not.toContain('dark:text-p-red-400')
    expect(screen.getByRole('textbox').className).toContain('border-p-red-300')
    expect(screen.getByRole('textbox').className).not.toContain('border-light-500')
    expect(screen.getByRole('textbox').className).not.toContain('dark:border-p-red-500')
  })
})
