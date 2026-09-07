import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DatePicker } from './DatePicker'

afterEach(() => cleanup())

describe('DatePicker', () => {
  it('aceita data mascarada e confirma meia-noite UTC quando não há hora', () => {
    const onValueChange = vi.fn()
    render(<DatePicker aria-label="Prazo" value={null} onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Prazo' }))
    const date = screen.getByLabelText('Data') as HTMLInputElement
    fireEvent.change(date, { target: { value: '04092026' } })

    expect(date.value).toBe('04/09/2026')
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    expect(onValueChange).toHaveBeenCalledWith('2026-09-04T00:00:00.000Z')
  })

  it('aceita seleção pelo calendário', () => {
    const onValueChange = vi.fn()
    render(
      <DatePicker
        aria-label="Prazo"
        value="2026-09-04T00:00:00.000Z"
        onValueChange={onValueChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Prazo' }))
    fireEvent.click(screen.getByRole('gridcell', { name: /^5 de setembro de 2026$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onValueChange).toHaveBeenCalledWith('2026-09-05T00:00:00.000Z')
  })

  it('permite intervalo com horário opcional', () => {
    const onValueChange = vi.fn()
    render(<DatePicker aria-label="Período" value={null} onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Período' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Intervalo' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Incluir horário' }))
    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '04092026' } })
    fireEvent.change(screen.getByLabelText('Hora inicial'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '10092026' } })
    fireEvent.change(screen.getByLabelText('Hora final'), { target: { value: '18:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))

    expect(onValueChange).toHaveBeenCalledWith(
      '2026-09-04T09:15:00.000Z@2026-09-10T18:30:00.000Z',
    )
  })

  it('registra o wire nativamente no react-hook-form', async () => {
    const onSubmit = vi.fn()

    function FormFixture() {
      const form = useForm<{ deadline: string | null }>({
        defaultValues: { deadline: null },
      })
      return (
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DatePicker name="deadline" aria-label="Prazo do formulário" />
            <button type="submit">Enviar</button>
          </form>
        </FormProvider>
      )
    }

    render(<FormFixture />)
    fireEvent.click(screen.getByRole('button', { name: 'Prazo do formulário' }))
    fireEvent.change(screen.getByLabelText('Data'), { target: { value: '04092026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        { deadline: '2026-09-04T00:00:00.000Z' },
        expect.anything(),
      ),
    )
  })
})
