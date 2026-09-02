import { describe, expect, it } from 'vitest'

import type { UserIdentity } from '@/types/user'
import {
  assignUserVisualIdentities,
  getBaseUserSlug,
} from './userVisualIdentity'

function user(id: string, name: string | null, email = `${id}@cubs.test`): UserIdentity {
  return { id, name, email }
}

describe('userVisualIdentity', () => {
  it('usa uma inicial sem sobrenome e duas com sobrenome, ignorando conectores', () => {
    expect(getBaseUserSlug(user('madonna', 'Madonna'))).toBe('M')
    expect(getBaseUserSlug(user('ada', 'Ada Lovelace'))).toBe('AL')
    expect(getBaseUserSlug(user('joao', 'João da Silva'))).toBe('JS')
    expect(getBaseUserSlug(user('fallback', null, 'grace.hopper@cubs.test'))).toBe('GH')
  })

  it('cresce para três caracteres somente quando as iniciais base colidem', () => {
    const identities = assignUserVisualIdentities([
      user('ana-silva', 'Ana Silva'),
      user('artur-souza', 'Artur Souza'),
      user('grace', 'Grace Hopper'),
      user('cher', 'Cher'),
    ])

    expect(identities[0]?.slug).toHaveLength(3)
    expect(identities[1]?.slug).toHaveLength(3)
    expect(identities[0]?.slug).not.toBe(identities[1]?.slug)
    expect(identities[2]?.slug).toBe('GH')
    expect(identities[3]?.slug).toBe('C')
  })

  it('não repete cores antes de esgotar a paleta e é estável ao reordenar a lista', () => {
    const participants = [
      user('one', 'Pessoa Um'),
      user('two', 'Pessoa Dois'),
      user('three', 'Pessoa Três'),
      user('four', 'Pessoa Quatro'),
      user('five', 'Pessoa Cinco'),
      user('six', 'Pessoa Seis'),
      user('seven', 'Pessoa Sete'),
      user('eight', 'Pessoa Oito'),
    ]
    const first = assignUserVisualIdentities(participants)
    const reordered = assignUserVisualIdentities([...participants].reverse())
    const reorderedById = new Map(reordered.map((identity) => [identity.id, identity]))

    expect(new Set(first.map((identity) => identity.color)).size).toBe(participants.length)
    for (const identity of first) {
      expect(reorderedById.get(identity.id)?.color).toBe(identity.color)
      expect(reorderedById.get(identity.id)?.slug).toBe(identity.slug)
    }
  })

  it('preserva a ordem e nunca altera os dados brutos do usuário', () => {
    const participants = [user('b', 'Bia'), user('a', 'Ana')]
    const identities = assignUserVisualIdentities(participants)

    expect(identities.map((identity) => identity.id)).toEqual(['b', 'a'])
    expect(participants).toEqual([user('b', 'Bia'), user('a', 'Ana')])
  })
})
