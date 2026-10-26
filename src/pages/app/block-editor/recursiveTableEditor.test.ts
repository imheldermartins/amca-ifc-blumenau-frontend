import { Editor } from '@tiptap/core'
import { CellSelection, TableMap, addColumnAfter, addRowAfter, setCellAttr, splitCell, toggleHeaderCell } from '@tiptap/pm/tables'
import { describe, expect, it } from 'vitest'
import { createRecursiveTableExtensions, mergeRecursiveSelection, readRecursiveTableDocument, recursiveTableDocument } from './recursiveTableEditor'
import type { RecursiveTable } from '@/shared/recursive-template'

const table = (): RecursiveTable => ({ columns: 2, rows: [0, 1].map((y) => ({ id: `row-${y}`, mode: 'repeat', cells: [0, 1].map((x) => ({ id: `cell-${y}-${x}`, column: x, text: `${y},${x}`, colSpan: 1, rowSpan: 1, header: false })) })) })
const setup = (value = table()) => new Editor({ extensions: createRecursiveTableExtensions(() => []), content: recursiveTableDocument(value) })
const select = (editor: Editor, a: number, b = a) => {
  const map = TableMap.get(editor.state.doc.firstChild!)
  editor.view.dispatch(editor.state.tr.setSelection(CellSelection.create(editor.state.doc, 1 + map.map[a]!, 1 + map.map[b]!)))
}

describe('native recursive table editing', () => {
  it.each([[0, 3], [3, 0], [1, 2], [2, 1]])('merges the complete rectangular selection independently of drag direction %j -> %j', (anchor, head) => {
    const editor = setup()
    try {
      select(editor, anchor, head)
      expect(mergeRecursiveSelection(editor.state, editor.view.dispatch)).toBe(true)
      const saved = readRecursiveTableDocument(editor.state.doc)
      expect(saved.rows[0].cells[0]).toMatchObject({ colSpan: 2, rowSpan: 2, text: '0,0\n0,1\n1,0\n1,1' })
      expect(saved.rows[1].cells).toEqual([])
      expect(splitCell(editor.state, editor.view.dispatch)).toBe(true)
      const split = readRecursiveTableDocument(editor.state.doc)
      expect(split.rows.map((row) => row.cells.length)).toEqual([2, 2])
      expect(new Set(split.rows.flatMap((row) => row.cells.map((cell) => cell.id))).size).toBe(4)
    } finally { editor.destroy() }
  })
  it('keeps cell alignment, headers and mention references through merges and document reload', () => {
    const value = table(), reference = '@{recursive:relation:relation:columns.amount}'
    value.rows[0].cells[0].text = reference
    const editor = setup(value)
    try {
      select(editor, 0, 1)
      setCellAttr('horizontalAlign', 'right')(editor.state, editor.view.dispatch)
      setCellAttr('verticalAlign', 'bottom')(editor.state, editor.view.dispatch)
      toggleHeaderCell(editor.state, editor.view.dispatch)
      mergeRecursiveSelection(editor.state, editor.view.dispatch)
      const saved = readRecursiveTableDocument(editor.state.doc)
      expect(saved.rows[0].cells[0]).toMatchObject({ header: true, horizontalAlign: 'right', verticalAlign: 'bottom', text: `${reference}\n0,1` })
      const restored = setup(saved)
      expect(readRecursiveTableDocument(restored.state.doc)).toEqual(saved)
      restored.destroy()
    } finally { editor.destroy() }
  })
  it('preserves a fixed total outside the repeated item when a rectangular selection crosses contexts', () => {
    const value = table(); value.rows[1].mode = 'static'
    const editor = setup(value)
    try {
      select(editor, 0, 3)
      expect(mergeRecursiveSelection(editor.state, editor.view.dispatch)).toBe(false)
      expect(readRecursiveTableDocument(editor.state.doc)).toEqual(value)
    } finally { editor.destroy() }
  })
  it('assigns unique persisted identities when adding rows/columns and retains canonical mentions', () => {
    const editor = setup()
    try {
      select(editor, 0)
      addColumnAfter(editor.state, editor.view.dispatch)
      addRowAfter(editor.state, editor.view.dispatch)
      const saved = readRecursiveTableDocument(editor.state.doc), ids = saved.rows.flatMap((row) => [row.id, ...row.cells.map((cell) => cell.id)])
      expect(saved.columns).toBe(3)
      expect(saved.rows).toHaveLength(3)
      expect(new Set(ids).size).toBe(ids.length)
    } finally { editor.destroy() }
  })
})
