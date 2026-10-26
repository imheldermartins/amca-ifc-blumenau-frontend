import { Extension, Node, mergeAttributes, type JSONContent } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import type { Node as DocumentNode } from '@tiptap/pm/model'
import { Plugin, type Command, type EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { CellSelection, TableMap, cellAround, goToNextCell, mergeCells, selectedRect, tableEditing } from '@tiptap/pm/tables'
import { i18n } from '@/lib/i18n'
import type { MentionOption } from '@/shared/mentions'
import { normalizeRecursiveTable, recursiveToken, type RecursiveTable, type RecursiveTableCell } from '@/shared/recursive-template'
import { createEditorMention } from './editorMention'

const role = (name: string) => ({ table: 'table', tableRow: 'row', tableCell: 'cell', tableHeader: 'header_cell' } as Record<string, string>)[name]
const idAttribute = { default: null, parseHTML: (element: HTMLElement) => element.dataset.recursiveId ?? null, renderHTML: (attrs: Record<string, unknown>) => ({ 'data-recursive-id': attrs.id }) }
const cellAttributes = () => ({
  id: idAttribute,
  colspan: { default: 1, parseHTML: (element: HTMLElement) => Number(element.getAttribute('colspan')) || 1 },
  rowspan: { default: 1, parseHTML: (element: HTMLElement) => Number(element.getAttribute('rowspan')) || 1 },
  colwidth: { default: null, renderHTML: () => ({}) },
  horizontalAlign: { default: 'left', parseHTML: (element: HTMLElement) => element.style.textAlign || 'left', renderHTML: () => ({}) },
  verticalAlign: { default: 'top', parseHTML: (element: HTMLElement) => element.style.verticalAlign || 'top', renderHTML: () => ({}) },
})

/** Uses the table selection, rectangular merge and span repair shipped with Tiptap's ProseMirror. */
export function createRecursiveTableExtensions(options: () => MentionOption[]) {
  const cells = (['tableCell', 'tableHeader'] as const).map((name) => Node.create({
    name, content: 'paragraph+', isolating: true, addAttributes: cellAttributes,
    parseHTML: () => [{ tag: name === 'tableHeader' ? 'th' : 'td' }],
    renderHTML: ({ node, HTMLAttributes }) => [name === 'tableHeader' ? 'th' : 'td', mergeAttributes(HTMLAttributes, {
      style: `text-align:${node.attrs.horizontalAlign};vertical-align:${node.attrs.verticalAlign}`,
    }), 0],
  }))
  return [
    Node.create({ name: 'doc', topNode: true, content: 'table' }),
    StarterKit.configure({ document: false, blockquote: false, bold: false, italic: false, strike: false, underline: false, code: false, codeBlock: false, heading: false, horizontalRule: false, bulletList: false, orderedList: false, listItem: false, listKeymap: false, link: false, trailingNode: false, dropcursor: false, gapcursor: false }),
    Node.create({ name: 'table', content: 'tableRow+', group: 'block', isolating: true,
      parseHTML: () => [{ tag: 'table' }], renderHTML: () => ['table', { 'aria-label': i18n('recursive.table') }, ['tbody', 0]],
    }),
    Node.create({ name: 'tableRow', content: '(tableCell|tableHeader)*',
      addAttributes: () => ({ id: idAttribute, mode: { default: 'static', parseHTML: (element: HTMLElement) => element.dataset.rowContext ?? 'static', renderHTML: (attrs) => ({ 'data-row-context': attrs.mode }) } }),
      parseHTML: () => [{ tag: 'tr' }], renderHTML: ({ HTMLAttributes }) => ['tr', HTMLAttributes, 0],
    }), ...cells,
    createEditorMention(options),
    Extension.create({ name: 'recursiveTableBehavior',
      extendNodeSchema: (extension) => role(extension.name) ? { tableRole: role(extension.name) } : {},
      addKeyboardShortcuts() { return {
        Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
        'Shift-Tab': () => goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
      } },
      addProseMirrorPlugins() { return [new Plugin({
        filterTransaction: (transaction) => {
          if (!transaction.docChanged) return true
          const table = transaction.doc.firstChild
          if (!table || table.childCount > 60 || TableMap.get(table).width > 40) return false
          let valid = true
          table.descendants((node) => { if (['cell', 'header_cell'].includes(node.type.spec.tableRole) && rawCellText(node).length > 4000) valid = false })
          return valid
        },
        appendTransaction: (transactions, _previous, state) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null
          const ids = new Set<string>(), tr = state.tr
          state.doc.descendants((node, position) => {
            if (!['row', 'cell', 'header_cell'].includes(node.type.spec.tableRole)) return
            let id = node.attrs.id as string | null
            if (!id || ids.has(id)) { id = crypto.randomUUID(); tr.setNodeMarkup(position, undefined, { ...node.attrs, id }) }
            ids.add(id)
          })
          return tr.docChanged ? tr : null
        },
        props: { decorations: (state) => {
          if (state.selection instanceof CellSelection) return null
          const cell = cellAround(state.selection.$from)
          const node = cell?.nodeAfter
          return cell && node ? DecorationSet.create(state.doc, [Decoration.node(cell.pos, cell.pos + node.nodeSize, { class: 'is-current-cell' })]) : null
        } },
      }), tableEditing()] },
    }),
  ]
}

function rawCellText(node: DocumentNode): string {
  if (node.type.name === 'text') return node.text ?? ''
  if (node.type.name === 'mention') return recursiveToken(String(node.attrs.id ?? ''))
  if (node.type.name === 'hardBreak') return '\n'
  const text: string[] = []
  node.forEach((child) => text.push(rawCellText(child)))
  return text.join(['tableCell', 'tableHeader'].includes(node.type.name) ? '\n' : '')
}

export function recursiveTableDocument(table: RecursiveTable): JSONContent {
  const paragraphs = (text: string): JSONContent[] => text.split('\n').map((line) => {
    const content: JSONContent[] = [], matches = line.matchAll(/@\{([^{}]{1,1600})\}/g)
    let offset = 0
    for (const match of matches) {
      if (match.index > offset) content.push({ type: 'text', text: line.slice(offset, match.index) })
      content.push({ type: 'mention', attrs: { id: match[1], mentionSuggestionChar: '@' } })
      offset = match.index + match[0].length
    }
    if (offset < line.length) content.push({ type: 'text', text: line.slice(offset) })
    return { type: 'paragraph', content }
  })
  return { type: 'doc', content: [{ type: 'table', content: table.rows.map((row) => ({ type: 'tableRow', attrs: { id: row.id, mode: row.mode }, content: row.cells.map((cell) => ({
    type: cell.header ? 'tableHeader' : 'tableCell', attrs: { id: cell.id, colspan: cell.colSpan, rowspan: cell.rowSpan, horizontalAlign: cell.horizontalAlign ?? 'left', verticalAlign: cell.verticalAlign ?? 'top' }, content: paragraphs(cell.text),
  })) })) }] }
}

export function readRecursiveTableDocument(doc: DocumentNode): RecursiveTable {
  const table = doc.firstChild!, map = TableMap.get(table), rows: RecursiveTable['rows'] = []
  table.forEach((row, rowOffset, y) => {
    const cells: RecursiveTableCell[] = []
    row.forEach((cell, offset) => cells.push({ id: cell.attrs.id ?? `${row.attrs.id}-${offset}`, column: map.findCell(rowOffset + 1 + offset).left, text: rawCellText(cell), colSpan: cell.attrs.colspan, rowSpan: cell.attrs.rowspan, header: cell.type.name === 'tableHeader',
      ...(cell.attrs.horizontalAlign !== 'left' && { horizontalAlign: cell.attrs.horizontalAlign }), ...(cell.attrs.verticalAlign !== 'top' && { verticalAlign: cell.attrs.verticalAlign }),
    }))
    rows.push({ id: row.attrs.id ?? `row-${y}`, mode: row.attrs.mode === 'repeat' ? 'repeat' : 'static', cells })
  })
  return normalizeRecursiveTable({ columns: map.width, rows })!
}

export function recursiveTableSelection(state: EditorState) {
  const cell = cellAround(state.selection.$from)
  if (!cell) return null
  const rect = selectedRect(state)
  const selected = state.selection instanceof CellSelection ? state.selection : CellSelection.create(state.doc, cell.pos)
  const cells: { node: DocumentNode; position: number }[] = []
  selected.forEachCell((node, position) => cells.push({ node, position }))
  const modes = new Set(Array.from({ length: rect.bottom - rect.top }, (_, index) => rect.table.child(rect.top + index).attrs.mode))
  return { ...rect, cells, mode: modes.size === 1 ? [...modes][0] as 'static' | 'repeat' : null }
}

/** A rowspan cannot span a page-level total and an independently repeated relation item. */
export const mergeRecursiveSelection: Command = (state, dispatch) => {
  const selection = recursiveTableSelection(state)
  return Boolean(selection?.mode && selection.cells.length > 1 && mergeCells(state, dispatch))
}
