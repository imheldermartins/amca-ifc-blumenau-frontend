import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { Collaborators } from './Collaborators'

afterEach(() => cleanup())

describe('Collaborators', () => {
  it('mantém acesso e presença separados e abre as configurações pelo trigger', () => {
    const onOpenSettings = vi.fn()
    render(
      <Collaborators
        participants={[
          {
            id: 'user-current',
            name: 'Pessoa Atual',
            email: 'atual@cubs.test',
            slug: 'PA',
            color: 'purple',
          },
          {
            id: 'user-other',
            name: 'Outra Pessoa',
            email: 'outra@cubs.test',
            slug: 'OP',
            color: 'blue',
          },
        ]}
        currentUserId="user-current"
        viewers={7}
        settingsOpen={false}
        onOpenSettings={onOpenSettings}
      />,
    )

    const trigger = screen.getByRole('button', {
      name: 'Abrir colaboradores da página (2 pessoas com acesso)',
    })
    expect(trigger.dataset.participants).toBe('2')
    expect(trigger.dataset.viewers).toBe('7')
    expect(screen.getByRole('img', { name: 'Pessoa Atual' }).className).toContain(
      'outline-p-purple-500',
    )

    fireEvent.click(trigger)
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })

  it('limita a pilha a três avatares e resume o restante sem perder a contagem', () => {
    const participants = Array.from({ length: 5 }, (_, index) => ({
      id: `user-${index}`,
      name: `Pessoa ${index}`,
      email: `pessoa-${index}@cubs.test`,
      slug: `P${index}`,
      color: 'blue' as const,
    }))
    render(
      <Collaborators
        participants={participants}
        currentUserId="user-0"
        viewers={1}
        settingsOpen={false}
        onOpenSettings={() => {}}
      />,
    )

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getByText('+2')).toBeTruthy()
    expect(
      screen.getByRole('button', {
        name: 'Abrir colaboradores da página (5 pessoas com acesso)',
      }).dataset.participants,
    ).toBe('5')
  })
})
