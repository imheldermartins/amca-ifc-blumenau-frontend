import { describe, expect, it } from 'vitest'

import type { DataViewSettings, HeaderCol, ViewFiltersV2 } from './types'
import {
  decodeViewFiltersUrl,
  encodeViewFiltersUrl,
  isViewFilterQueryKey,
  viewFiltersSemanticSignature,
} from './viewFilterUrl'

const VIEW_ID = '01KXVZ0000VIEW00000000001'
const COLUMN_ID = '01KXVZ0000COLUMN000000001'
const OPTION_A = '01KXVZ0000OPTION000000001'
const OPTION_B = '01KXVZ0000OPTION000000002'
const DATE_ID = '01KXVZ0000COLUMN000000002'

const filters: ViewFiltersV2 = {
  version: 2,
  updatedAt: '2026-09-01T12:00:00.000Z',
  clauses: [
    { columnId: COLUMN_ID, condition: 'equals', values: [OPTION_A, OPTION_B] },
  ],
  groupBy: [COLUMN_ID],
  passthrough: [],
}
const settings: DataViewSettings = {
  [VIEW_ID]: {
    view: 'table',
    name: 'Docentes',
    urlKey: { key: 'docentes', aliases: ['professores'] },
    filters,
    orderedHeaderCols: [COLUMN_ID],
  },
}
const columns: HeaderCol[] = [
  {
    id: COLUMN_ID,
    title: 'Área de atuação',
    type: 'select',
    publicKey: { key: 'area_de_atuacao', aliases: ['area'] },
    options: [
      { id: OPTION_A, label: 'Administração', publicKey: { key: 'administracao', aliases: [] } },
      { id: OPTION_B, label: 'Computação', publicKey: { key: 'computacao', aliases: [] } },
    ],
  },
  {
    id: DATE_ID,
    title: 'Data de ingresso',
    type: 'date',
    publicKey: { key: 'data_de_ingresso', aliases: [] },
  },
]

describe('viewFilterUrl', () => {
  it('codifica somente keys legíveis e preserva prioridade/múltiplos valores', () => {
    const encoded = encodeViewFiltersUrl(VIEW_ID, filters, settings, columns)
    expect(encoded).toEqual({
      view: 'docentes',
      fv: '2',
      group: 'area_de_atuacao',
      'f.area_de_atuacao.equals': ['administracao', 'computacao'],
    })
    expect(JSON.stringify(encoded)).not.toContain(VIEW_ID)
    expect(JSON.stringify(encoded)).not.toContain(COLUMN_ID)
    expect(JSON.stringify(encoded)).not.toContain(OPTION_A)
  })

  it('resolve aliases e pede canonicalização sem trocar identidades internas', () => {
    const decoded = decodeViewFiltersUrl(
      {
        view: 'professores',
        fv: '2',
        group: 'area',
        'f.area.equals': ['administracao', 'computacao'],
      },
      settings,
      columns,
    )
    expect(decoded.viewId).toBe(VIEW_ID)
    expect(decoded.needsCanonicalReplace).toBe(true)
    expect(viewFiltersSemanticSignature(decoded.filters)).toBe(
      viewFiltersSemanticSignature(filters),
    )
  })

  it('preserva between e cláusulas repetidas como f1/f2', () => {
    const document: ViewFiltersV2 = {
      version: 2,
      updatedAt: null,
      clauses: [
        {
          columnId: DATE_ID,
          condition: 'between',
          values: ['2026-01-01', '2026-12-31'],
        },
        { columnId: DATE_ID, condition: 'equals', values: ['2026-06-01'] },
        { columnId: DATE_ID, condition: 'equals', values: ['2026-07-01'] },
      ],
      groupBy: [COLUMN_ID, DATE_ID],
      passthrough: [],
    }
    const encoded = encodeViewFiltersUrl(VIEW_ID, document, settings, columns)
    expect(encoded.group).toEqual(['area_de_atuacao', 'data_de_ingresso'])
    expect(encoded['f.data_de_ingresso.between']).toEqual([
      '2026-01-01',
      '2026-12-31',
    ])
    expect(encoded['f.data_de_ingresso.equals']).toBe('2026-06-01')
    expect(encoded['f1.data_de_ingresso.equals']).toBe('2026-07-01')

    const decoded = decodeViewFiltersUrl(encoded, settings, columns)
    expect(viewFiltersSemanticSignature(decoded.filters)).toBe(
      viewFiltersSemanticSignature(document),
    )
  })

  it('não escolhe silenciosamente uma key ambígua', () => {
    const ambiguousColumns: HeaderCol[] = [
      ...columns,
      {
        id: '01KXVZ0000COLUMN000000002',
        title: 'Outra área',
        type: 'text',
        publicKey: { key: 'area_de_atuacao', aliases: [] },
      },
    ]
    const decoded = decodeViewFiltersUrl(
      { view: 'docentes', fv: '2', group: 'area_de_atuacao' },
      settings,
      ambiguousColumns,
    )
    expect(decoded.filters.groupBy).toEqual([])
    expect(decoded.diagnostics).toContainEqual({
      kind: 'ambiguous',
      domain: 'column',
      key: 'area_de_atuacao',
    })
  })

  it('lê URL legada com ULIDs e a marca para replace', () => {
    const legacy = new URLSearchParams()
    legacy.set('v', '1')
    legacy.append('group', COLUMN_ID)
    const decoded = decodeViewFiltersUrl(
      { view: VIEW_ID, filters: legacy.toString() },
      settings,
      columns,
    )
    expect(decoded.viewId).toBe(VIEW_ID)
    expect(decoded.filters.groupBy).toEqual([COLUMN_ID])
    expect(decoded.needsCanonicalReplace).toBe(true)
  })

  it('reserva e limpa tentativas de cláusula malformadas', () => {
    const malformedKeys = [
      'f.area_de_atuacao',
      'f1..equals',
      'f2.area_de_atuacao.equals.extra',
      'f3.area__de_atuacao.equals',
    ]
    for (const key of malformedKeys) expect(isViewFilterQueryKey(key)).toBe(true)

    const decoded = decodeViewFiltersUrl(
      {
        view: 'docentes',
        'f.area_de_atuacao': 'administracao',
        'f1..equals': 'administracao',
        'f2.area_de_atuacao.equals.extra': 'administracao',
        'f3.area__de_atuacao.equals': 'administracao',
      },
      settings,
      columns,
    )

    expect(decoded.explicit).toBe(true)
    expect(decoded.filters.clauses).toEqual([])
    expect(decoded.needsCanonicalReplace).toBe(true)
    expect(decoded.diagnostics).toHaveLength(malformedKeys.length)
  })

  it('não captura parâmetros comuns que apenas começam com f', () => {
    for (const key of ['f', 'f1', 'foo', 'from', 'format', 'filter', 'favorite']) {
      expect(isViewFilterQueryKey(key)).toBe(false)
    }
    expect(isViewFilterQueryKey('f.area_de_atuacao.equals')).toBe(true)
    expect(isViewFilterQueryKey('f12.area_de_atuacao.equals')).toBe(true)
  })
})
