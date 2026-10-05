import { describe, expect, it } from 'vitest'
import { BOARD_UNASSIGNED, boardColumn, boardKey, boardRowOrder, parseBoardConfig, relocateBoardCard } from './boardView'
import type { HeaderCol } from './types'

const SELECT = '01KXVZ00000000000000000001'
const OPTION = '01KXVZ00000000000000000002'
const column: HeaderCol = { id: SELECT, title: 'Tema', type: 'select', options: [{ id: OPTION, label: 'Azul' }] }
describe('Board projection', () => {
  it('shares untouched lists and returns the same object while the slot is unchanged', () => {
    const groups = { first: ['a', 'b', 'c'], second: ['d'], untouched: ['e', 'f'] }
    expect(relocateBoardCard(groups, 'a', 'first', 'b')).toBe(groups)
    const reordered = relocateBoardCard(groups, 'a', 'first', 'b', true)
    expect(reordered.first).toEqual(['b', 'a', 'c'])
    expect(reordered.second).toBe(groups.second)
    expect(reordered.untouched).toBe(groups.untouched)
    const transferred = relocateBoardCard(reordered, 'a', 'second', 'd')
    expect(transferred.first).toEqual(['b', 'c'])
    expect(transferred.second).toEqual(['a', 'd'])
    expect(transferred.untouched).toBe(groups.untouched)
    expect(groups.first).toEqual(['a', 'b', 'c'])
  })
  it('uses the configured ULID and does not silently replace a deleted select', () => {
    expect(boardColumn([column])).toBe(column)
    expect(boardColumn([column], { selectColumnId: SELECT })).toBe(column)
    expect(boardColumn([column], { selectColumnId: OPTION })).toBeUndefined()
  })
  it('keeps missing and orphan options in Sem valor without displaying IDs', () => {
    expect(boardKey({ id: 'row', cells: {} }, column)).toBe(BOARD_UNASSIGNED)
    expect(boardKey({ id: 'row', cells: { [SELECT]: { value: 'deleted' } } }, column)).toBe(BOARD_UNASSIGNED)
    expect(boardKey({ id: 'row', cells: { [SELECT]: { value: OPTION } } }, column)).toBe(OPTION)
  })
  it('reorders only the dragged row and preserves filtered-out rows', () => {
    const rows = ['a', 'hidden-1', 'b', 'hidden-2', 'c'].map((id) => ({ id, cells: {} }))
    expect(boardRowOrder(rows, 'c', 'b')).toEqual(['a', 'hidden-1', 'c', 'b', 'hidden-2'])
    expect(boardRowOrder(rows, 'a', undefined, 'c')).toEqual(['hidden-1', 'b', 'hidden-2', 'c', 'a'])
  })
  it('parses empty property preferences, canonical ids and the reserved Board key', () => {
    expect(parseBoardConfig({ selectColumnId: SELECT, optionOrder: [OPTION, OPTION, BOARD_UNASSIGNED, 'bad'], propertyIds: [], showPropertyLabels: false }))
      .toEqual({ selectColumnId: SELECT, optionOrder: [OPTION, BOARD_UNASSIGNED], propertyIds: [], showPropertyLabels: false })
  })
})
