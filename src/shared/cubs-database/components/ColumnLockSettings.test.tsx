import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Drawer } from 'cubs-components'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ColumnLockSettings, type ColumnLockSettingsLabels } from './ColumnLockSettings'

const labels: ColumnLockSettingsLabels = {
  title: 'Bloqueio de colunas',
  description: 'Escolha quem pode editar cada coluna.',
  search: 'Buscar pessoa',
  empty: 'Nenhuma pessoa encontrada',
  allowed: 'Permitidos',
  locked: 'Bloqueada',
}

const columns = [
  { id: 'title-column', key: 'title' as const, title: 'Nome', type: 'text' as const },
  { id: 'status-column', title: 'Status', type: 'select' as const },
]

const editors = [
  { id: 'user-1', name: 'Ana Lima', email: 'ana@example.com' },
  { id: 'user-2', name: 'Bruno Reis', email: 'bruno@example.com' },
  { id: 'user-3', name: null, email: 'carla@example.com' },
]

afterEach(() => cleanup())

describe('ColumnLockSettings', () => {
  it('permite focar e pesquisar dentro da drawer, sem fechar a configuração', async () => {
    render(<Drawer open onOpenChange={vi.fn()} accessibleTitle="Configurações da view" closeLabel="Fechar">
      <ColumnLockSettings
        columns={columns}
        locks={{ 'status-column': { userIds: ['user-1'] } }}
        editors={editors}
        currentUserId="user-1"
        onChange={vi.fn()}
        labels={labels}
      />
    </Drawer>)

    fireEvent.click(screen.getByRole('button', { name: /Permitidos/ }))
    const search = await screen.findByRole('searchbox', { name: 'Buscar pessoa' })
    act(() => search.focus())
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'bruno@' } })
    expect(screen.queryByText('Ana Lima')).toBeNull()
    expect(screen.getByRole('checkbox', { name: 'Permitidos: Bruno Reis' })).not.toBeNull()
    expect(screen.getByRole('dialog', { name: 'Configurações da view' })).not.toBeNull()
  })

  it('habilita e desabilita o lock usando a chave contratual da coluna', () => {
    const onChange = vi.fn()
    render(<ColumnLockSettings
      columns={columns}
      locks={{ 'status-column': { userIds: ['user-1', 'user-2'] } }}
      editors={editors}
      currentUserId="user-1"
      onChange={onChange}
      labels={labels}
    />)

    const titleLock = screen.getByRole('switch', { name: 'Nome' })
    const statusLock = screen.getByRole('switch', { name: 'Status' })
    expect(titleLock.getAttribute('aria-checked')).toBe('false')
    expect(statusLock.getAttribute('aria-checked')).toBe('true')

    fireEvent.click(titleLock)
    expect(onChange).toHaveBeenCalledWith('title', ['user-1'])

    fireEvent.click(statusLock)
    expect(onChange).toHaveBeenCalledWith('status-column', [])
  })

  it('mantém o usuário atual permitido e edita a allowlist pelo popover pesquisável', async () => {
    const onChange = vi.fn()
    render(<ColumnLockSettings
      columns={columns}
      locks={{ 'status-column': { userIds: ['user-1', 'user-2'] } }}
      editors={editors}
      currentUserId="user-1"
      onChange={onChange}
      labels={labels}
    />)

    fireEvent.click(screen.getByRole('button', { name: /Permitidos/ }))

    const actor = await screen.findByRole('checkbox', { name: 'Permitidos: Ana Lima' })
    const bruno = screen.getByRole('checkbox', { name: 'Permitidos: Bruno Reis' })
    const carla = screen.getByRole('checkbox', { name: 'Permitidos: carla@example.com' })
    expect((actor as HTMLButtonElement).disabled).toBe(true)
    expect(actor.getAttribute('data-state')).toBe('checked')

    fireEvent.click(carla)
    expect(onChange).toHaveBeenCalledWith(
      'status-column',
      ['user-1', 'user-2', 'user-3'],
    )

    fireEvent.click(bruno)
    expect(onChange).toHaveBeenCalledWith('status-column', ['user-1'])

    fireEvent.change(screen.getByPlaceholderText('Buscar pessoa'), {
      target: { value: 'carla@' },
    })
    expect(screen.queryByText('Ana Lima')).toBeNull()
    expect(screen.getByText('carla@example.com')).not.toBeNull()

    fireEvent.change(screen.getByPlaceholderText('Buscar pessoa'), {
      target: { value: 'ninguém' },
    })
    expect(screen.getByText('Nenhuma pessoa encontrada')).not.toBeNull()
  })
})
