import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clientLocalStorage } from '@/lib/clientStorage'

/**
 * O `clientLocalStorage` guarda PREFERÊNCIA de usuário — e os testes cuidam
 * das três garantias que ele existe para dar: namespace, tolerância a JSON
 * quebrado e sobrevivência a storage indisponível. As duas últimas são o que
 * impede uma preferência corrompida ou o modo privativo de derrubar a tela.
 */
describe('clientLocalStorage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('grava sob o namespace cubs. — o chamador nunca escreve o prefixo', () => {
    clientLocalStorage.set('theme', 'dark')

    expect(localStorage.getItem('cubs.theme')).toBe('"dark"')
    expect(localStorage.getItem('theme')).toBeNull()
    expect(clientLocalStorage.get('theme')).toBe('dark')
  })

  it('cobre string, number, boolean e objeto (round-trip JSON)', () => {
    clientLocalStorage.set('n', 42)
    clientLocalStorage.set('b', true)
    clientLocalStorage.set('o', { a: 1, b: [2, 3] })

    expect(clientLocalStorage.get<number>('n')).toBe(42)
    expect(clientLocalStorage.get<boolean>('b')).toBe(true)
    expect(clientLocalStorage.get<{ a: number; b: number[] }>('o')).toEqual({ a: 1, b: [2, 3] })
  })

  it('chave ausente devolve undefined', () => {
    expect(clientLocalStorage.get('nao-existe')).toBeUndefined()
  })

  it('JSON quebrado devolve undefined E limpa a chave', () => {
    // Simula um valor gravado fora do formato (versão antiga, corrupção).
    localStorage.setItem('cubs.legado', 'isto-nao-e-json{')

    expect(clientLocalStorage.get('legado')).toBeUndefined()
    // A chave foi removida para a próxima leitura não repetir o erro.
    expect(localStorage.getItem('cubs.legado')).toBeNull()
  })

  it('null/undefined apagam a chave em vez de gravar "null"', () => {
    clientLocalStorage.set('x', 'valor')
    clientLocalStorage.set('x', null)

    expect(localStorage.getItem('cubs.x')).toBeNull()
    expect(clientLocalStorage.get('x')).toBeUndefined()
  })

  it('remove apaga a chave', () => {
    clientLocalStorage.set('x', 'valor')
    clientLocalStorage.remove('x')
    expect(clientLocalStorage.get('x')).toBeUndefined()
  })

  it('storage indisponível (modo privativo) NÃO derruba a tela', () => {
    // setItem lançando é o comportamento do Safari em modo privativo.
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    // A preferência não persiste, mas a chamada não pode propagar o erro.
    expect(() => clientLocalStorage.set('theme', 'dark')).not.toThrow()
  })
})
