import { describe, expect, it } from 'vitest'

import { parsePublicKeyMetadata } from './publicKeys'

describe('parsePublicKeyMetadata', () => {
  it('aceita somente keys e aliases no formato público canônico', () => {
    expect(
      parsePublicKeyMetadata({
        key: 'area_de_atuacao_2',
        aliases: ['area', 'area_antiga'],
      }),
    ).toEqual({
      key: 'area_de_atuacao_2',
      aliases: ['area', 'area_antiga'],
    })

    for (const key of [
      '_area',
      'area_',
      'area__atuacao',
      'Área',
      'area-de-atuacao',
      'area.de.atuacao',
      '',
    ]) {
      expect(parsePublicKeyMetadata({ key, aliases: [] })).toBeNull()
    }
  })

  it('rejeita o documento inteiro quando qualquer alias é inválido', () => {
    expect(
      parsePublicKeyMetadata({
        key: 'area_de_atuacao',
        aliases: ['area', 'area__antiga'],
      }),
    ).toBeNull()
  })
})
