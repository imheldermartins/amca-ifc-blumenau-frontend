import { describe, expect, it } from 'vitest'

import { buildTableGroups, formatTableGroupValue } from './tableGroups'

describe('buildTableGroups', () => {
  it('respeita prioridade, cria níveis e mantém chave baseada no valor cru', () => {
    const rows = [
      { id: '1', cells: { area: { value: 'admin' }, active: { value: true } } },
      { id: '2', cells: { area: { value: 'admin' }, active: { value: false } } },
      { id: '3', cells: { area: { value: 'tech' }, active: { value: true } } },
    ]

    const groups = buildTableGroups(rows, ['area', 'active'])
    expect(groups.map((group) => group.rawValue)).toEqual(['admin', 'tech'])
    expect(groups[0].children.map((group) => group.rawValue)).toEqual([true, false])
    expect(groups[0].key).toContain('string%3Aadmin')
    expect(groups[0].children[0].rows.map((row) => row.id)).toEqual(['1'])
  })

  it('formata datetime no rótulo do agrupamento sem expor o valor persistido', () => {
    expect(formatTableGroupValue(
      '2026-09-04T14:30:00.000Z',
      { id: 'starts_at', title: 'Início', type: 'date' },
      'date',
      { empty: 'Sem valor', true: 'Sim', false: 'Não', rows: (count) => `${count}` },
    )).toBe('04/09/2026 14:30')
  })
})
