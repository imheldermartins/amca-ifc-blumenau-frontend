import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormProvider, useForm } from 'react-hook-form'

const loadWorkspaceIconCatalog = vi.hoisted(() => vi.fn())

vi.mock('@/lib/workspaceIconCatalog', () => ({ loadWorkspaceIconCatalog }))
vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}))

import { IconPicker } from './IconPicker'

afterEach(() => cleanup())

describe('IconPicker', () => {
  it('atualiza o campo RHF antes de avisar a seleção e o blur ao cabeçalho', async () => {
    loadWorkspaceIconCatalog.mockResolvedValueOnce([{ library: 'cuida', name: 'archive', value: 'cuida:archive' }])
    const change = vi.fn(), blur = vi.fn()
    function HeaderPicker() {
      const form = useForm({ defaultValues: { icon: 'lucide:smile' } })
      return <FormProvider {...form}>
        <IconPicker name="icon" label="Ícone" variant="icon"
          labels={{ choose: 'Escolher', search: 'Buscar', empty: 'Vazio', loading: 'Carregando', loadMore: 'Mais' }}
          onValueChange={(next) => change(next, form.getValues('icon'))} onBlur={blur} />
      </FormProvider>
    }
    render(<HeaderPicker />)
    fireEvent.click(screen.getByRole('button', { name: 'Ícone' }))
    fireEvent.click(await screen.findByRole('option', { name: 'archive' }))
    expect(change).toHaveBeenCalledWith('cuida:archive', 'cuida:archive')
    expect(blur).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('mescla as bibliotecas, ordena pelo nome e usa busca com ícone nativo', async () => {
    loadWorkspaceIconCatalog.mockResolvedValueOnce([
      { library: 'lucide', name: 'zebra', value: 'lucide:zebra' },
      { library: 'cuida', name: 'archive', value: 'cuida:archive' },
    ])
    render(
      <IconPicker
        label="Ícone"
        labels={{
          choose: 'Escolher ícone',
          search: 'Buscar ícone',
          empty: 'Vazio',
          loading: 'Carregando',
          loadMore: 'Mais',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ícone' }))
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2))

    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('aria-label')))
      .toEqual(['archive', 'zebra'])
    const search = screen.getByRole('searchbox', { name: 'Buscar ícone' })
    expect(search.parentElement?.querySelector('[data-icon="lucide:search"]')).toBeTruthy()
  })
})
