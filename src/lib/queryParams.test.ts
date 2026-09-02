import { describe, expect, it } from 'vitest'

import {
  applyQueryPatch,
  parseQuerySearch,
  readList,
  replaceQueryNamespace,
  stringifyQuerySearch,
} from './queryParams'

describe('queryParams', () => {
  it('preserva arrays como chaves repetidas e remove arrays vazios', () => {
    expect(applyQueryPatch({}, { group: ['area', 'status'] })).toEqual({
      group: ['area', 'status'],
    })
    expect(applyQueryPatch({ group: ['area'] }, { group: [] })).toEqual({
      group: undefined,
    })
    expect(readList(['area', 10, true])).toEqual(['area', '10', 'true'])
  })

  it('substitui um namespace numa única operação e preserva query alheia', () => {
    const current = {
      q: 'ana',
      fv: 1,
      group: ['id-antigo'],
      'f.nome.contains': 'Ana',
    }

    expect(
      replaceQueryNamespace(
        current,
        (key) => key === 'fv' || key === 'group' || key.startsWith('f.'),
        { fv: 2, group: ['area', 'status'] },
      ),
    ).toEqual({
      q: 'ana',
      fv: 2,
      group: ['area', 'status'],
      'f.nome.contains': undefined,
    })
  })

  it('serializa a URL pública sem JSON e repete grupos e valores', () => {
    const encoded = stringifyQuerySearch({
      view: 'docentes',
      fv: '2',
      group: ['area_de_atuacao', 'efetivo'],
      'f.efetivo.equals': ['true', 'false'],
      'f.codigo.equals': '001',
    })

    expect(encoded).toBe(
      '?view=docentes&fv=2&group=area_de_atuacao&group=efetivo&f.efetivo.equals=true&f.efetivo.equals=false&f.codigo.equals=001',
    )
    expect(encoded).not.toContain('%22')
    expect(parseQuerySearch(encoded)).toEqual({
      view: 'docentes',
      fv: '2',
      group: ['area_de_atuacao', 'efetivo'],
      'f.efetivo.equals': ['true', 'false'],
      'f.codigo.equals': '001',
    })
  })
})
