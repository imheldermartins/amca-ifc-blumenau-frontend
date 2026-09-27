import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

import { ColumnLayoutRules, MAX_COLUMNS } from './columnLayoutRules'

export { MAX_COLUMNS } from './columnLayoutRules'

export type EditorDropTarget =
  | { type: 'row'; rowId: string; edge: 'before' | 'after' }
  | { type: 'column'; columnId: string; edge: 'left' | 'right' }
  | { type: 'item'; blockId: string; edge: 'before' | 'after' }

interface RowEntry {
  id: string
  node: ProseMirrorNode
}

function stringAttribute(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function getRows(doc: ProseMirrorNode): RowEntry[] {
  const rows: RowEntry[] = []

  doc.forEach((node) => {
    if (node.type.name !== 'blockRow') return
    const id = stringAttribute(node.attrs.id)
    if (id) rows.push({ id, node })
  })

  return rows
}

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = []
  node.forEach((child) => children.push(child))
  return children
}

function copyColumn(
  column: ProseMirrorNode,
  blocks: ProseMirrorNode[],
  span: number,
): ProseMirrorNode {
  return column.type.create({ ...column.attrs, span }, blocks, column.marks)
}

export function columnSpans(count: number): number[] {
  return ColumnLayoutRules.equalWidths(count)
}

function normalizeRow(
  row: ProseMirrorNode,
  columns: ProseMirrorNode[],
): ProseMirrorNode {
  const spans = columnSpans(columns.length)
  return row.type.create(
    row.attrs,
    columns.map((column, index) =>
      copyColumn(column, childNodes(column), spans[index]),
    ),
    row.marks,
  )
}

function normalizeStoredRow(row: ProseMirrorNode): ProseMirrorNode {
  const columns = childNodes(row)
  const widths = ColumnLayoutRules.normalize(
    columns.map((column) => column.attrs.span),
  )
  return row.type.create(
    row.attrs,
    columns.map((column, index) =>
      copyColumn(column, childNodes(column), widths[index]),
    ),
    row.marks,
  )
}

function findBlock(rows: RowEntry[], blockId: string) {
  for (const row of rows) {
    const columns = childNodes(row.node)
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]
      const blocks = childNodes(column)
      const blockIndex = blocks.findIndex((block) => block.attrs.id === blockId)
      if (blockIndex >= 0) {
        return {
          row,
          columns,
          column,
          columnIndex,
          blocks,
          blockIndex,
          block: blocks[blockIndex],
        }
      }
    }
  }
  return null
}

function findColumn(rows: ProseMirrorNode[], columnId: string) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const columns = childNodes(row)
    const columnIndex = columns.findIndex((column) => column.attrs.id === columnId)
    if (columnIndex >= 0) return { row, rowIndex, columns, columnIndex }
  }
  return null
}

function findTargetBlock(rows: ProseMirrorNode[], blockId: string) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const columns = childNodes(row)
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const column = columns[columnIndex]
      const blocks = childNodes(column)
      const blockIndex = blocks.findIndex((block) => block.attrs.id === blockId)
      if (blockIndex >= 0) {
        return { row, rowIndex, columns, column, columnIndex, blocks, blockIndex }
      }
    }
  }
  return null
}

export function moveBlockToDrop(
  doc: ProseMirrorNode,
  activeBlockId: string,
  target: EditorDropTarget,
): ProseMirrorNode[] | null {
  if (target.type === 'item' && target.blockId === activeBlockId) return null

  const originalRows = getRows(doc).map((entry) => ({
    ...entry,
    node: normalizeStoredRow(entry.node),
  }))
  const source = findBlock(originalRows, activeBlockId)
  if (!source) return null

  const rows = originalRows.map((entry) => entry.node)
  const sourceRowIndex = originalRows.findIndex((entry) => entry.id === source.row.id)
  const sourceColumns = [...source.columns]
  const sourceBlocks = [...source.blocks]
  const [activeBlock] = sourceBlocks.splice(source.blockIndex, 1)

  const removesSourceColumn = sourceBlocks.length === 0
  if (removesSourceColumn) sourceColumns.splice(source.columnIndex, 1)
  else {
    sourceColumns[source.columnIndex] = copyColumn(
      source.column,
      sourceBlocks,
      ColumnLayoutRules.storedWidth(source.column.attrs.span),
    )
  }

  if (sourceColumns.length === 0) rows.splice(sourceRowIndex, 1)
  else if (removesSourceColumn) {
    rows[sourceRowIndex] = normalizeRow(source.row.node, sourceColumns)
  } else {
    rows[sourceRowIndex] = source.row.node.type.create(
      source.row.node.attrs,
      sourceColumns,
      source.row.node.marks,
    )
  }

  if (target.type === 'row') {
    const targetRowIndex = rows.findIndex((row) => row.attrs.id === target.rowId)
    if (targetRowIndex < 0) return null

    const newColumn = source.column.type.create(
      {
        ...source.column.attrs,
        id: crypto.randomUUID(),
        span: ColumnLayoutRules.totalPercent,
      },
      activeBlock,
    )
    const newRow = source.row.node.type.create(
      { ...source.row.node.attrs, id: crypto.randomUUID() },
      newColumn,
    )
    rows.splice(targetRowIndex + (target.edge === 'after' ? 1 : 0), 0, newRow)
    return rows
  }

  if (target.type === 'column') {
    const targetColumn = findColumn(rows, target.columnId)
    if (!targetColumn || targetColumn.columns.length >= MAX_COLUMNS) return null

    const newColumn = source.column.type.create(
      {
        ...source.column.attrs,
        id: crypto.randomUUID(),
        span: ColumnLayoutRules.totalPercent,
      },
      activeBlock,
    )
    const targetColumns = [...targetColumn.columns]
    targetColumns.splice(
      targetColumn.columnIndex + (target.edge === 'right' ? 1 : 0),
      0,
      newColumn,
    )
    rows[targetColumn.rowIndex] = normalizeRow(targetColumn.row, targetColumns)
    return rows
  }

  const targetBlock = findTargetBlock(rows, target.blockId)
  if (!targetBlock) return null

  const targetBlocks = [...targetBlock.blocks]
  targetBlocks.splice(
    targetBlock.blockIndex + (target.edge === 'after' ? 1 : 0),
    0,
    activeBlock,
  )
  const targetColumns = [...targetBlock.columns]
  targetColumns[targetBlock.columnIndex] = copyColumn(
    targetBlock.column,
    targetBlocks,
    ColumnLayoutRules.storedWidth(targetBlock.column.attrs.span),
  )
  rows[targetBlock.rowIndex] = targetBlock.row.type.create(
    targetBlock.row.attrs,
    targetColumns,
    targetBlock.row.marks,
  )
  return rows
}
