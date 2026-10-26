import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { EditorContent, useEditor } from '@tiptap/react'
import type { Editor } from '@tiptap/core'
import { CellSelection, addColumnAfter, addRowAfter, deleteColumn, deleteRow, setCellAttr, splitCell, toggleHeaderCell } from '@tiptap/pm/tables'
import { TextSelection, type Command } from '@tiptap/pm/state'
import { Button, Select, Tooltip, cn } from 'cubs-components'
import { useOptionalMention } from '@/hooks/useMention'
import { useEditorEnvironment } from './editorEnvironmentContext'
import { RecursiveBlockHelp } from './RecursiveBlockHelp'
import { pdfMentionOptions, recursiveMentionOptions } from './recursiveEditor'
import { createRecursiveTableExtensions, mergeRecursiveSelection, readRecursiveTableDocument, recursiveTableDocument, recursiveTableSelection } from './recursiveTableEditor'
import { i18n } from '@/lib/i18n'
import { CHILD_TITLE, normalizeRecursiveTable, readRecursiveConfig, recursiveTable, recursiveToken, relationTitle, relationColumn, type RecursiveConfig } from '@/shared/recursive-template'

export function RecursiveTableBlock({ value, onChange, onDelete, readOnly = false }: { value: unknown; onChange: (config: RecursiveConfig) => void; onDelete: () => void; readOnly?: boolean }) {
  const { recursiveRelations = [], recursiveColumns = [] } = useEditorEnvironment()
  const context = useOptionalMention()
  const [config, setConfig] = useState(() => readRecursiveConfig(value))
  const seenValue = useRef(value)
  if (seenValue.current !== value) { seenValue.current = value; setConfig(readRecursiveConfig(value)) }
  const table = recursiveTable(config)
  const commit = (next: RecursiveConfig): void => { setConfig(next); latest.current.config = next; onChange(next) }
  const relation = recursiveRelations.find((entry) => entry.id === config.relationColumnId)
  const latest = useRef({ config, commit, pageOptions: [...(context?.options ?? []), ...pdfMentionOptions(recursiveColumns)], relatedOptions: relation ? recursiveMentionOptions(relation.columns, relation.id, relation.name) : [] })
  latest.current = { config, commit, pageOptions: [...(context?.options ?? []), ...pdfMentionOptions(recursiveColumns)], relatedOptions: relation ? recursiveMentionOptions(relation.columns, relation.id, relation.name) : [] }
  const [, redraw] = useState(0)
  const editorRef = useRef<Editor | null>(null)
  const editor = useEditor({
    extensions: createRecursiveTableExtensions(() => editorRef.current && recursiveTableSelection(editorRef.current.state)?.mode === 'repeat' ? [...latest.current.pageOptions, ...latest.current.relatedOptions] : latest.current.pageOptions),
    content: recursiveTableDocument(table), editable: !readOnly,
    onUpdate: ({ editor }) => latest.current.commit({ ...latest.current.config, table: readRecursiveTableDocument(editor.state.doc) }),
    onTransaction: ({ transaction }) => { if (transaction.docChanged || transaction.selectionSet) redraw((value) => value + 1) },
    editorProps: { attributes: { 'aria-label': i18n('recursive.table') } },
  })
  editorRef.current = editor
  useEffect(() => { editor?.setEditable(!readOnly, false) }, [editor, readOnly])
  useEffect(() => {
    if (!editor || JSON.stringify(table) === JSON.stringify(readRecursiveTableDocument(editor.state.doc))) return
    const selected = recursiveTableSelection(editor.state), anchorId = selected?.cells[0]?.node.attrs.id, endId = selected?.cells.at(-1)?.node.attrs.id
    const wasRange = editor.state.selection instanceof CellSelection
    editor.commands.setContent(recursiveTableDocument(table), { emitUpdate: false })
    let anchor: number | undefined, end: number | undefined
    editor.state.doc.descendants((node, position) => { if (node.attrs.id === anchorId) anchor = position; if (node.attrs.id === endId) end = position })
    if (anchor !== undefined) editor.view.dispatch(editor.state.tr.setSelection(wasRange && end !== undefined ? CellSelection.create(editor.state.doc, anchor, end) : TextSelection.near(editor.state.doc.resolve(anchor + 2))))
  }, [editor, table])
  if (!editor) return null
  const selection = recursiveTableSelection(editor.state)
  const active = selection?.cells[0]?.node
  const count = selection?.cells.length ?? 0
  const selectedHeader = count > 0 && selection!.cells.every(({ node }) => node.type.name === 'tableHeader')
  const run = (command: Command) => { command(editor.state, editor.view.dispatch); editor.view.focus() }
  const control = (labelKey: string, icon: string, command: Command, options: { disabled?: boolean; pressed?: boolean; text?: boolean; help?: string } = {}) => {
    const label = i18n(`recursive.${labelKey}`)
    return <Tooltip content={options.help ?? label}><span className="inline-flex"><Button variant="text" color="from-theme" aria-label={label} disabled={options.disabled} aria-pressed={options.pressed}
      className={cn('h-8 px-2 text-xs font-normal', !options.text && 'w-8 p-0', options.pressed && 'bg-p-purple/10 text-p-purple')}
      onMouseDown={(event) => event.preventDefault()} onClick={() => run(command)}><Icon icon={icon} aria-hidden="true" className="size-4" />{options.text ? label : null}</Button></span></Tooltip>
  }
  const addRow = (mode: 'static' | 'repeat'): Command => (state, dispatch) => addRowAfter(state, dispatch ? (tr) => {
    tr.doc.descendants((node, position) => { if (node.type.name === 'tableRow' && !node.attrs.id) tr.setNodeMarkup(position, undefined, { ...node.attrs, mode }) })
    dispatch(tr)
  } : undefined)
  const changeRelation = (selected: string) => {
    const previous = config.relationColumnId, next = readRecursiveTableDocument(editor.state.doc)
    for (const row of next.rows) for (const cell of row.cells) {
      if (previous) cell.text = cell.text.replace(/@\{recursive:relation:([^:}]+):[^{}]+\}/g, (token, id: string) => id === previous ? '' : token)
      cell.text = cell.text.replaceAll(recursiveToken(CHILD_TITLE), recursiveToken(relationTitle(selected))).replace(/@\{recursive:child:columns\.([^{}]+)\}/g, (_token, id: string) => recursiveToken(relationColumn(selected, id)))
    }
    commit({ ...config, relationColumnId: selected, table: next })
  }
  const changeMode = (mode: string) => {
    if (!selection) return
    const next = readRecursiveTableDocument(editor.state.doc)
    next.rows.forEach((row, index) => { if (index >= selection.top && index < selection.bottom) row.mode = mode as 'static' | 'repeat' })
    next.rows.forEach((row, index) => row.cells.forEach((cell) => {
      if (next.rows.slice(index, index + cell.rowSpan).some((other) => other.mode !== row.mode)) cell.rowSpan = 1
    }))
    commit({ ...config, table: normalizeRecursiveTable(next) })
  }
  return <section contentEditable={false} data-recursive-block="tableRecursive" className="min-w-0">
    {!readOnly && <div role="toolbar" aria-label={i18n('recursive.table-tools')} className="mb-2 flex flex-wrap items-center gap-1">
      <Select aria-label={i18n('recursive.relation')} value={config.relationColumnId ?? ''} placeholder={i18n('recursive.choose-relation')}
        disabled={!recursiveRelations.length} className="w-48 max-w-full [&_button]:h-8 [&_button]:text-xs" onValueChange={changeRelation}
        options={[...(config.relationColumnId && !relation ? [{ value: config.relationColumnId, label: i18n('recursive.removed'), disabled: true }] : []), ...recursiveRelations.map((entry) => ({ value: entry.id, label: entry.name }))]} />
      <RecursiveBlockHelp kind="table" />
      <span className="mx-1 h-5 border-l border-divider" />
      {control('add-column', 'lucide:columns-3', addColumnAfter, { disabled: table.columns >= 40 })}
      {control('add-repeat-row', 'lucide:rows-3', addRow('repeat'), { disabled: table.rows.length >= 60 || !relation })}
      {control('add-static-row', 'lucide:between-horizontal-start', addRow('static'), { disabled: table.rows.length >= 60 })}
      {active && <>
        <span className="mx-1 h-5 border-l border-divider" />
        {control('header-cell', 'lucide:heading', toggleHeaderCell, { pressed: selectedHeader })}
        {(['left', 'center', 'right', 'justify'] as const).map((align) => <span key={align}>{control(`align-${align}`, `lucide:align-${align}`, setCellAttr('horizontalAlign', align), { pressed: selection!.cells.every(({ node }) => node.attrs.horizontalAlign === align) })}</span>)}
        <span className="mx-1 h-5 border-l border-divider" />
        {(['top', 'middle', 'bottom'] as const).map((align, index) => <span key={align}>{control(`align-${align}`, ['lucide:align-start-vertical', 'lucide:align-center-vertical', 'lucide:align-end-vertical'][index]!, setCellAttr('verticalAlign', align), { pressed: selection!.cells.every(({ node }) => node.attrs.verticalAlign === align) })}</span>)}
        {count > 1 && control('merge-cells', 'lucide:table-cells-merge', mergeRecursiveSelection, { text: true, disabled: !mergeRecursiveSelection(editor.state), help: selection?.mode ? undefined : i18n('recursive.merge-context-help') })}
        {count === 1 && (active.attrs.colspan > 1 || active.attrs.rowspan > 1) && control('split', 'lucide:table-cells-split', splitCell)}
        <Select aria-label={i18n('recursive.row-context')} value={selection?.mode ?? ''} placeholder={i18n('recursive.mixed-context')} className="w-44 [&_button]:h-8 [&_button]:text-xs" onValueChange={changeMode}
          options={[{ value: 'static', label: i18n('recursive.static-row') }, { value: 'repeat', label: i18n('recursive.repeat-row'), disabled: !relation }]} />
        {control('remove-row', 'lucide:table-rows-split', deleteRow, { disabled: selection!.bottom - selection!.top >= table.rows.length })}
        {control('remove-column', 'lucide:table-columns-split', deleteColumn, { disabled: selection!.right - selection!.left >= table.columns })}
      </>}
      <Button type="button" variant="text" color="from-theme" className="ml-auto size-8 p-0" aria-label={i18n('recursive.remove-block')} onClick={onDelete}><Icon icon="lucide:trash-2" aria-hidden="true" className="size-4" /></Button>
    </div>}
    {!relation && !readOnly && <p className="mb-2 text-xs opacity-60">{i18n(recursiveRelations.length ? 'recursive.choose-relation' : 'recursive.no-relations')}</p>}
    <EditorContent editor={editor} className={cn('recursive-table-editor min-w-0', !readOnly && 'is-editable')} />
  </section>
}
