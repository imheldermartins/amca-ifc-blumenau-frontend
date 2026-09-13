import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it } from 'vitest'

import { SwitchAccordion } from './SwitchAccordion'

afterEach(cleanup)

describe('SwitchAccordion', () => {
  it('expande o pai e bloqueia os filhos ao desligar, preservando suas escolhas', () => {
    function Permissions() {
      const [parent, setParent] = useState(false)
      const [child, setChild] = useState(true)
      return (
        <SwitchAccordion label="Editar páginas" checked={parent} onCheckedChange={setParent}>
          <SwitchAccordion label="Editar subpáginas" checked={child} onCheckedChange={setChild} />
        </SwitchAccordion>
      )
    }
    const { container } = render(<Permissions />)
    expect(screen.queryByRole('switch', { name: 'Editar subpáginas' })).toBeNull()
    expect(container.querySelector('fieldset')?.disabled).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Editar páginas' }))
    expect(screen.getByRole('switch', { name: 'Editar subpáginas' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('switch', { name: 'Editar páginas' }))
    expect(container.querySelector('fieldset')?.disabled).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Editar páginas' }))
    expect(screen.getByRole('switch', { name: 'Editar subpáginas' }).getAttribute('aria-checked')).toBe('true')
  })

  it('integra o estado ao RHF e respeita disabled', () => {
    function Form() {
      const form = useForm({ defaultValues: { write: false } })
      return (
        <FormProvider {...form}>
          <SwitchAccordion label="Permitir edição" name="write" />
          <SwitchAccordion label="Owner" checked onCheckedChange={() => { throw new Error('Não pode alterar') }} disabled />
          <output>{String(form.watch('write'))}</output>
        </FormProvider>
      )
    }
    render(<Form />)
    fireEvent.click(screen.getByRole('switch', { name: 'Permitir edição' }))
    expect(screen.getByRole('status').textContent).toBe('true')
    expect((screen.getByRole('switch', { name: 'Owner' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
