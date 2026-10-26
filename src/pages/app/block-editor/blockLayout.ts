import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { ColumnLayoutRules, MAX_COLUMNS } from './columnLayoutRules'
export { MAX_COLUMNS } from './columnLayoutRules'

export type EditorDropTarget =
  | { type: 'row'; rowId: string; edge: 'before' | 'after' }
  | { type: 'column'; columnId: string; edge: 'left' | 'right' }
  | { type: 'item'; blockId: string; edge: 'before' | 'after' }

interface LayoutRow { kind: 'row'; node: ProseMirrorNode; columns: LayoutColumn[]; parent: LayoutColumn | null }
interface LayoutColumn { node: ProseMirrorNode; items: LayoutItem[]; parent: LayoutRow }
type LayoutItem = LayoutRow | ProseMirrorNode
const isRow = (item: LayoutItem): item is LayoutRow => 'kind' in item && item.kind === 'row'
export const columnSpans = (count: number) => ColumnLayoutRules.equalWidths(count)

/** Every row owns its columns; nested rows remain inside their own column. */
export function moveBlockToDrop(doc: ProseMirrorNode, activeBlockId: string, target: EditorDropTarget): ProseMirrorNode[] | null {
  if (target.type === 'item' && target.blockId === activeBlockId) return null
  const allRows: LayoutRow[] = [], allColumns: LayoutColumn[] = []
  const parseRow = (node: ProseMirrorNode, parent: LayoutColumn | null): LayoutRow => {
    const row: LayoutRow = { kind: 'row', node, columns: [], parent }; allRows.push(row)
    node.forEach((columnNode) => {
      const column: LayoutColumn = { node: columnNode, items: [], parent: row }; row.columns.push(column); allColumns.push(column)
      columnNode.forEach((item) => column.items.push(item.type.name === 'blockRow' ? parseRow(item, column) : item))
    })
    return row
  }
  const roots: LayoutRow[] = []
  doc.forEach((node) => { if (node.type.name === 'blockRow') roots.push(parseRow(node, null)) })
  const findBlock = (id: string) => {
    for (const column of allColumns) {
      const index = column.items.findIndex((item) => !isRow(item) && item.attrs.id === id)
      if (index >= 0) return { column, index, node: column.items[index] as ProseMirrorNode }
    }
    return null
  }
  const source = findBlock(activeBlockId)
  if (!source) return null
  const targetRow = target.type === 'row' ? allRows.find((row) => row.node.attrs.id === target.rowId) : undefined
  const targetColumn = target.type === 'column' ? allColumns.find((column) => column.node.attrs.id === target.columnId) : undefined
  const targetBlock = target.type === 'item' ? findBlock(target.blockId) : undefined
  if (target.type === 'row' && (!targetRow || targetRow === source.column.parent && targetRow.columns.length === 1 && source.column.items.length === 1)) return null
  if (target.type === 'column' && (!targetColumn || targetColumn === source.column && source.column.items.length === 1)) return null
  if (target.type === 'item' && !targetBlock) return null
  source.column.items.splice(source.index, 1)
  if (target.type === 'item' && targetBlock) {
    const index = targetBlock.column.items.indexOf(targetBlock.node)
    targetBlock.column.items.splice(index + (target.edge === 'after' ? 1 : 0), 0, source.node)
  } else {
    const newColumn = (parent: LayoutRow): LayoutColumn => ({ node: source.column.node.type.create({ ...source.column.node.attrs, id: crypto.randomUUID(), span: 100 }, source.node), items: [source.node], parent })
    if (target.type === 'column' && targetColumn) {
      const row = targetColumn.parent
      row.columns = row.columns.filter((column) => column.items.length > 0)
      if (row.columns.length >= MAX_COLUMNS) return null
      row.columns.splice(row.columns.indexOf(targetColumn) + (target.edge === 'right' ? 1 : 0), 0, newColumn(row))
    } else if (target.type === 'row' && targetRow) {
      const row: LayoutRow = { kind: 'row', node: source.column.parent.node.type.create({ ...source.column.parent.node.attrs, id: crypto.randomUUID() }), columns: [], parent: targetRow.parent }
      row.columns = [newColumn(row)]
      const siblings = targetRow.parent?.items ?? roots
      const index = siblings.indexOf(targetRow)
      siblings.splice(index + (target.edge === 'after' ? 1 : 0), 0, row)
    }
  }
  const build = (row: LayoutRow): ProseMirrorNode | null => {
    const columns = row.columns.flatMap((column) => {
      const items = column.items.flatMap((item) => { const node = isRow(item) ? build(item) : item; return node ? [node] : [] })
      return items.length ? [{ column, items }] : []
    })
    if (!columns.length) return null
    const widths = columns.length === row.node.childCount ? ColumnLayoutRules.normalize(columns.map(({ column }) => column.node.attrs.span)) : columnSpans(columns.length)
    return row.node.type.create(row.node.attrs, columns.map(({ column, items }, index) => column.node.type.create({ ...column.node.attrs, span: widths[index] }, items, column.node.marks)), row.node.marks)
  }
  const result = roots.flatMap((row) => { const node = build(row); return node ? [node] : [] })
  return result.length ? result : null
}
