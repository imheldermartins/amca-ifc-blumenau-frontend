import { describe, expect, it } from 'vitest'
import { displayMentionText, projectMentions, editMentionProjection } from './mentionPresentation'

const a = '@{pages:01M00000000000000000000001:title}'
const b = '@{recursive:relation:items:columns.total}'
const resolve = (text: string) => text.replaceAll(a, 'Lote').replaceAll(b, 'Total')

describe('mention presentation without rewriting references', () => {
  it('resolves nested references and hides missing, cyclic and unrecognized references', () => {
    expect(displayMentionText(`Nome ${a}`, () => b, 'Indisponível')).toBe('Nome Indisponível')
    expect(displayMentionText(a, (text) => text === a ? b : '42')).toBe('42')
    expect(displayMentionText(`${a} ${b}`, resolve)).toBe('Lote Total')
    expect(displayMentionText(a)).toBe('Indisponível')
    expect(displayMentionText('@{unknown:internal:id}', (text) => text)).toBe('Indisponível')
  })
  it('preserves references while editing before, after and between them', () => {
    const projection = projectMentions(`A ${a} / ${b} Z`, resolve)
    expect(projection.text).toBe('A Lote / Total Z')
    expect(editMentionProjection(projection, 'X A Lote / Total Z').value).toBe(`X A ${a} / ${b} Z`)
    expect(editMentionProjection(projection, 'A Lote / Total ZZ').value).toBe(`A ${a} / ${b} ZZ`)
    expect(editMentionProjection(projection, 'A Lote + Total Z').value).toBe(`A ${a} + ${b} Z`)
  })
  it('replaces or removes the whole reference when a selection overlaps its display', () => {
    const projection = projectMentions(`A ${a} Z`, resolve)
    expect(editMentionProjection(projection, 'A Lo Z').value).toBe('A  Z')
    expect(editMentionProjection(projection, 'A novo Z', { start: 2, end: 6 }).value).toBe('A novo Z')
  })
  it('uses selection to disambiguate an insertion between identical mention labels', () => {
    const projection = projectMentions(a + b, () => 'A')
    expect(editMentionProjection(projection, 'AAA', { start: 1, end: 1 }).value).toBe(a + 'A' + b)
    expect(editMentionProjection(projection, 'AA', { start: 0, end: 1 }).value).toBe('A' + b)
  })
})
