import { describe, expect, it } from 'vitest'

import { reorderByIds, resolveColumnTypes } from './utils'
import type { HeaderCol, RowData } from './types'

/**
 * Os dois utils que a leva de memoização tocou por PERFORMANCE (`Set` no lugar
 * de `includes`, caminho curto do tipo declarado). Os testes fixam o
 * COMPORTAMENTO para provar que a otimização não mudou o resultado — é a única
 * razão de eles cobrirem util puro numa suíte "de segurança".
 */
describe('reorderByIds', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('reordena pela lista de ids, sem mutar o original', () => {
    const result = reorderByIds(items, ['c', 'a', 'b'])
    expect(result.map((i) => i.id)).toEqual(['c', 'a', 'b'])
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c']) // intacto
  })

  it('ids desconhecidos são ignorados; itens fora da lista vão para o fim', () => {
    const result = reorderByIds(items, ['b', 'fantasma'])
    expect(result.map((i) => i.id)).toEqual(['b', 'a', 'c'])
  })

  it('lista vazia devolve cópia na ordem original', () => {
    const result = reorderByIds(items, [])
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(result).not.toBe(items)
  })
})

describe('resolveColumnTypes', () => {
  const rows: RowData[] = [
    { id: 'r1', cells: { c1: { value: 'texto' }, c2: { value: 10 } } },
    { id: 'r2', cells: { c1: { value: 'outro' }, c2: { value: 20 } } },
  ]

  it('caminho curto: coluna com type DECLARADO não infere', () => {
    // Mesmo com valores numéricos, o type declarado manda — é o caso do app
    // real (o parser sempre declara, vindo de page_columns).
    const cols: HeaderCol[] = [{ id: 'c2', title: 'N', type: 'text' }]
    expect(resolveColumnTypes(cols, rows).c2).toBe('text')
  })

  it('sem type declarado, infere dos valores da coluna', () => {
    const cols: HeaderCol[] = [
      { id: 'c1', title: 'Texto' },
      { id: 'c2', title: 'Número' },
    ]
    const types = resolveColumnTypes(cols, rows)
    expect(types.c1).toBe('text')
    expect(types.c2).toBe('numeric')
  })

  it('coluna sem valor em nenhuma linha cai em text (denominador comum)', () => {
    const cols: HeaderCol[] = [{ id: 'vazia', title: 'Vazia' }]
    expect(resolveColumnTypes(cols, rows).vazia).toBe('text')
  })
})
