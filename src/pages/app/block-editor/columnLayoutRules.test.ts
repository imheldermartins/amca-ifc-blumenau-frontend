import { describe, expect, it } from 'vitest'

import { ColumnLayoutRules } from './columnLayoutRules'

describe('ColumnLayoutRules', () => {
  it.each([
    [1, [100]],
    [2, [50, 50]],
    [3, [33.3333, 33.3333, 33.3334]],
    [4, [25, 25, 25, 25]],
  ])('distribui %i colunas pela largura total', (count, expected) => {
    expect(ColumnLayoutRules.equalWidths(count)).toEqual(expected)
  })

  it('converte os spans antigos em percentuais sem alterar a proporção', () => {
    expect(ColumnLayoutRules.normalize([3, 1])).toEqual([75, 25])
    expect(ColumnLayoutRules.normalize([2, 1, 1])).toEqual([50, 25, 25])
  })

  it('redimensiona continuamente o par e conserva a soma da row', () => {
    const resized = ColumnLayoutRules.resizeBoundary([50, 50], 0, 12.3456)

    expect(resized).toEqual([62.3456, 37.6544])
    expect(resized.reduce((total, width) => total + width, 0)).toBe(100)
  })

  it('não deixa nenhuma coluna ficar abaixo de um quarto da row', () => {
    expect(ColumnLayoutRules.resizeBoundary([50, 50], 0, 90)).toEqual([75, 25])
    expect(ColumnLayoutRules.resizeBoundary([50, 50], 0, -90)).toEqual([25, 75])
  })

  it('oferece presets compatíveis com a quantidade de colunas', () => {
    expect(ColumnLayoutRules.presets(3).map((preset) => preset.widths)).toEqual([
      [33.3333, 33.3333, 33.3334],
      [25, 25, 50],
      [25, 50, 25],
      [50, 25, 25],
    ])
  })

  it('ancora o primeiro valor do preset na coluna do bloco acionado', () => {
    expect(ColumnLayoutRules.anchor([25, 75], 1)).toEqual([75, 25])
    expect(ColumnLayoutRules.anchor([25, 25, 50], 2)).toEqual([25, 50, 25])
  })
})
