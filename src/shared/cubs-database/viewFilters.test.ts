import { describe, expect, it } from 'vitest'

import type { HeaderCol, RowData } from './types'
import {
  VIEW_FILTERS_VERSION,
  applyViewFilters,
  canonicalizeViewFilters,
  getFilterCondition,
  hasViewFilters,
  mappedFilters,
  matchesViewFilter,
  parseViewFilters,
  serializeViewFilters,
  type ParsedViewFilters,
  type ViewFilterClause,
} from './viewFilters'

const where = (filter: ViewFilterClause): string => JSON.stringify(filter)

describe('viewFilters codec', () => {
  it('converte vazio legado no documento v2 sem inventar critérios', () => {
    const parsed = parseViewFilters('')

    expect(parsed).toEqual({
      version: VIEW_FILTERS_VERSION,
      updatedAt: null,
      clauses: [],
      groupBy: [],
      passthrough: [],
    })
    expect(hasViewFilters(parsed)).toBe(false)
    expect(serializeViewFilters(parsed)).toBe('v=1')
  })

  it('lê grupos repetidos por prioridade, wheres e preserva chaves desconhecidas', () => {
    const params = new URLSearchParams()
    params.append('v', '1')
    params.append('group', 'area')
    params.append('group', 'efetivo')
    params.append(
      'where',
      where({ columnId: 'nome', condition: 'contains', values: ['Ana'] }),
    )
    params.append('order', 'updated_at')
    params.append('order', 'title')

    const parsed = parseViewFilters(params.toString())

    expect(parsed.version).toBe(VIEW_FILTERS_VERSION)
    expect(parsed.updatedAt).toBeNull()
    expect(parsed.groupBy).toEqual(['area', 'efetivo'])
    expect(parsed.clauses).toEqual([
      { columnId: 'nome', condition: 'contains', values: ['Ana'] },
    ])
    expect(parsed.passthrough).toEqual([
      ['order', 'updated_at'],
      ['order', 'title'],
    ])

    expect(parseViewFilters(serializeViewFilters(parsed))).toEqual(parsed)
  })

  it('migra o group legado real sem perder order=updated_at', () => {
    const parsed = parseViewFilters(
      'group=01KXDN4B50AHEQZQ7J9H48PYEG&order=updated_at',
    )

    expect(parsed).toMatchObject({
      version: VIEW_FILTERS_VERSION,
      updatedAt: null,
      groupBy: ['01KXDN4B50AHEQZQ7J9H48PYEG'],
      clauses: [],
      passthrough: [['order', 'updated_at']],
    })

    const canonical = canonicalizeViewFilters(
      'group=01KXDN4B50AHEQZQ7J9H48PYEG&order=updated_at',
    )
    expect(canonical).toContain('v=1')
    expect(parseViewFilters(canonical)).toMatchObject({
      groupBy: ['01KXDN4B50AHEQZQ7J9H48PYEG'],
      passthrough: [['order', 'updated_at']],
    })
  })

  it('preserva formatos legados desconhecidos, inclusive chave sem igual', () => {
    const parsed = parseViewFilters('status=published&status%3Aaberto')

    expect(parsed.passthrough).toEqual([
      ['status', 'published'],
      ['status:aberto', ''],
    ])
    expect(parseViewFilters(serializeViewFilters(parsed)).passthrough).toEqual(
      parsed.passthrough,
    )
  })

  it('preserva where inválido ou com extensão futura em vez de truncá-lo', () => {
    const invalidJson = '{não-json'
    const futureShape = JSON.stringify({
      columnId: 'nome',
      condition: 'equals',
      values: ['Ana'],
      logicalOperator: 'or',
    })
    const params = new URLSearchParams({ v: '1' })
    params.append('where', invalidJson)
    params.append('where', futureShape)

    const parsed = parseViewFilters(params.toString())

    expect(parsed.clauses).toEqual([])
    expect(parsed.passthrough).toEqual([
      ['where', invalidJson],
      ['where', futureShape],
    ])
    expect(parseViewFilters(serializeViewFilters(parsed)).passthrough).toEqual(
      parsed.passthrough,
    )
  })

  it('não interpreta versão string desconhecida e preserva seus pares opacos', () => {
    const futureWhere = where({
      columnId: 'nome',
      condition: 'equals',
      values: ['Ana'],
    })
    const params = new URLSearchParams()
    params.append('v', '2')
    params.append('group', 'area')
    params.append('where', futureWhere)
    params.append('new-key', 'new-value')

    const parsed = parseViewFilters(params.toString())

    expect(parsed).toEqual({
      version: VIEW_FILTERS_VERSION,
      updatedAt: null,
      clauses: [],
      groupBy: [],
      passthrough: [
        ['group', 'area'],
        ['where', futureWhere],
        ['new-key', 'new-value'],
      ],
    })
  })

  it('preserva v duplicado como passthrough', () => {
    const parsed = parseViewFilters('v=1&v=experimental&group=area')

    expect(parsed.version).toBe(VIEW_FILTERS_VERSION)
    expect(parsed.groupBy).toEqual(['area'])
    expect(parsed.passthrough).toEqual([['v', 'experimental']])
    expect(parseViewFilters(serializeViewFilters(parsed))).toEqual(parsed)
  })

  it('aceita objeto v2, clona arrays e poda shape/timestamp inválidos', () => {
    const source = {
      version: 2 as const,
      updatedAt: 'não-é-data',
      clauses: [
        { columnId: 'nome', condition: 'contains' as const, values: ['Ana'] },
        { columnId: '', condition: 'contains' as const, values: ['inválido'] },
        {
          columnId: 'futuro',
          condition: 'equals' as const,
          values: ['x'],
          logicalOperator: 'or',
        },
      ],
      groupBy: ['area', '', 42],
      passthrough: [['order', 'updated_at'], ['inválido']],
    }

    const parsed = parseViewFilters(source as never)
    expect(parsed).toEqual({
      version: 2,
      updatedAt: null,
      clauses: [{ columnId: 'nome', condition: 'contains', values: ['Ana'] }],
      groupBy: ['area'],
      passthrough: [['order', 'updated_at']],
    })
    expect(parsed).not.toBe(source)
    expect(parsed.clauses).not.toBe(source.clauses)
  })

  it('preserva somente timestamp autoritativo válido no objeto v2', () => {
    const updatedAt = '2026-08-30T12:00:00.000Z'
    expect(parseViewFilters({ ...parseViewFilters(''), updatedAt }).updatedAt).toBe(updatedAt)
  })
})

describe('mappedFilters', () => {
  it('cobre exaustivamente os tipos e oferece somente as condições previstas', () => {
    expect(Object.keys(mappedFilters).sort()).toEqual([
      'checkbox',
      'date',
      'numeric',
      'select',
      'text',
    ])
    expect(mappedFilters.text.conditions.map(({ id }) => id)).toEqual(['equals', 'contains'])
    expect(mappedFilters.numeric.conditions.map(({ id }) => id)).toEqual([
      'equals',
      'greaterThan',
      'lessThan',
    ])
    expect(mappedFilters.select.conditions.map(({ id }) => id)).toEqual(['equals'])
    expect(mappedFilters.date.conditions.map(({ id }) => id)).toEqual(['equals', 'between'])
    expect(mappedFilters.checkbox.conditions.map(({ id }) => id)).toEqual(['equals'])
    expect(getFilterCondition('numeric', 'contains')).toBeUndefined()
  })
})

const columns: HeaderCol[] = [
  { id: 'title', key: 'title', title: 'Nome', type: 'text' },
  { id: 'score', title: 'Nota', type: 'numeric' },
  {
    id: 'area',
    title: 'Área',
    type: 'select',
    options: [
      { id: 'admin', label: 'Administração' },
      { id: 'computing', label: 'Computação' },
    ],
  },
  { id: 'effective', title: 'Efetivo', type: 'checkbox' },
  { id: 'period', title: 'Período', type: 'date' },
]

const rows: RowData[] = [
  {
    id: 'r1',
    cells: {
      title: { value: 'Ána Clara' },
      score: { value: 0 },
      area: { value: 'admin' },
      effective: { value: false },
      period: { value: '2026-08-10T00:00:00.000Z@2026-08-20T23:59:59.999Z' },
    },
  },
  {
    id: 'r2',
    cells: {
      title: { value: 'Bruno' },
      score: { value: 10 },
      area: { value: 'computing' },
      effective: { value: true },
      period: { value: '2026-09-01T12:00:00.000Z' },
    },
  },
  {
    id: 'r3',
    cells: {
      title: { value: '' },
      score: { value: -5 },
      area: { value: 'admin' },
      effective: { value: false },
      period: { value: '2026-07-01T12:00:00.000Z' },
    },
  },
]

describe('view filter predicates', () => {
  it('faz texto case/acentuação-insensitive e preserva igualdade com string vazia', () => {
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'title', condition: 'contains', values: ['ana'] },
      ]).map(({ id }) => id),
    ).toEqual(['r1'])

    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'title', condition: 'equals', values: [''] },
      ]).map(({ id }) => id),
    ).toEqual(['r3'])
  })

  it('compara numeric incluindo zero', () => {
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'score', condition: 'equals', values: ['0'] },
      ]).map(({ id }) => id),
    ).toEqual(['r1'])
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'score', condition: 'greaterThan', values: ['0'] },
      ]).map(({ id }) => id),
    ).toEqual(['r2'])
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'score', condition: 'lessThan', values: ['0'] },
      ]).map(({ id }) => id),
    ).toEqual(['r3'])
  })

  it('faz OR entre values de select usando IDs e filtra checkbox false', () => {
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'area', condition: 'equals', values: ['admin', 'computing'] },
      ]),
    ).toHaveLength(3)
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'effective', condition: 'equals', values: ['false'] },
      ]).map(({ id }) => id),
    ).toEqual(['r1', 'r3'])
  })

  it('compara datas e considera sobreposição inclusiva no between', () => {
    expect(
      applyViewFilters(rows, columns, [
        {
          columnId: 'period',
          condition: 'between',
          values: ['2026-08-15', '2026-08-25'],
        },
      ]).map(({ id }) => id),
    ).toEqual(['r1'])
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'period', condition: 'equals', values: ['2026-09-01T12:00:00.000Z'] },
      ]).map(({ id }) => id),
    ).toEqual(['r2'])
  })

  it('faz AND entre cláusulas', () => {
    expect(
      applyViewFilters(rows, columns, [
        { columnId: 'area', condition: 'equals', values: ['admin'] },
        { columnId: 'effective', condition: 'equals', values: ['false'] },
        { columnId: 'score', condition: 'greaterThan', values: ['-1'] },
      ]).map(({ id }) => id),
    ).toEqual(['r1'])
  })

  it('ignora coluna removida, condição incompatível e valor incompleto', () => {
    const untouched = applyViewFilters(rows, columns, [
      { columnId: 'removed', condition: 'equals', values: ['x'] },
      { columnId: 'score', condition: 'contains', values: ['1'] },
      { columnId: 'score', condition: 'greaterThan', values: [''] },
    ])

    expect(untouched).toBe(rows)
  })

  it('matchesViewFilter também tolera uma cláusula incompatível', () => {
    const document: ParsedViewFilters = {
      version: VIEW_FILTERS_VERSION,
      updatedAt: null,
      clauses: [],
      groupBy: [],
      passthrough: [],
    }
    expect(hasViewFilters(document)).toBe(false)
    expect(
      matchesViewFilter(
        rows[0],
        columns[1],
        'numeric',
        { columnId: 'score', condition: 'contains', values: ['0'] },
      ),
    ).toBe(true)
  })
})
