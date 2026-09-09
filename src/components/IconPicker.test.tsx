import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const loadWorkspaceIconCatalog = vi.hoisted(() => vi.fn())

vi.mock('@/lib/workspaceIconCatalog', () => ({ loadWorkspaceIconCatalog }))
vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}))

import { IconPicker } from './IconPicker'

afterEach(() => cleanup())

describe('IconPicker', () => {
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
