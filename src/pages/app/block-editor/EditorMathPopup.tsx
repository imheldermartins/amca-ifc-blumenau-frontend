import type { Editor } from '@tiptap/core'
import { NodeSelection, Selection } from '@tiptap/pm/state'
import * as Popover from '@radix-ui/react-popover'
import { useEffect, useRef, useState } from 'react'
import { Button } from 'cubs-components'
import { Icon } from '@iconify/react'

import { i18n } from '@/lib/i18n'
import { FLOATING_SURFACE_CLASSES } from '@/shared/cubs-components/menuStyles'

const isMath = (name?: string) => name === 'inlineMath' || name === 'blockMath'

function MathForm({ editor, position, close }: { editor: Editor; position: number; close: () => void }) {
  const node = editor.state.doc.nodeAt(position)
  const [latex, setLatex] = useState(String(node?.attrs.latex ?? ''))
  const apply = () => {
    const current = editor.state.doc.nodeAt(position)
    if (!current || !isMath(current.type.name) || !latex.trim()) return
    const transaction = editor.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, latex: latex.trim() })
    transaction.setSelection(Selection.near(transaction.doc.resolve(position + current.nodeSize), 1))
    close()
    editor.view.dispatch(transaction)
    editor.commands.focus(undefined, { scrollIntoView: false })
  }
  const remove = () => {
    const current = editor.state.doc.nodeAt(position)
    if (!current || !isMath(current.type.name)) return
    close()
    if (current.type.name === 'inlineMath') {
      const transaction = editor.state.tr.delete(position, position + current.nodeSize)
      transaction.setSelection(Selection.near(transaction.doc.resolve(position)))
      editor.view.dispatch(transaction)
      editor.commands.focus(undefined, { scrollIntoView: false })
    }
    else {
      const resolved = editor.state.doc.resolve(position)
      if (resolved.parent.type.name === 'editableBlock' && resolved.parent.childCount === 1) {
        const block = resolved.parent
        const start = resolved.before()
        const replacement = block.type.create({ ...block.attrs, kind: 'richText' }, editor.schema.nodes.paragraph.create())
        const transaction = editor.state.tr.replaceWith(start, start + block.nodeSize, replacement)
        transaction.setSelection(Selection.near(transaction.doc.resolve(start + 1)))
        editor.view.dispatch(transaction)
        editor.commands.focus(undefined, { scrollIntoView: false })
      } else editor.chain().deleteBlockMath({ pos: position }).focus(undefined, { scrollIntoView: false }).run()
    }
  }
  return <form className="grid w-80 max-w-[calc(100vw-2rem)] gap-3" onSubmit={(event) => { event.preventDefault(); apply() }}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">{i18n('pages.block-editor.math.edit')}</h3>
      <button type="button" aria-label={i18n('pages.block-editor.math.remove')} onClick={remove} className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs hover:bg-active">
        <Icon icon="lucide:x" className="size-4 text-p-red" />
        {node?.type.name === 'blockMath' && <span>{i18n('pages.block-editor.math.remove-label')}</span>}
      </button>
    </div>
    <div className="flex items-start gap-2 rounded-lg border border-divider p-2 font-mono">
      <input aria-label={i18n('pages.block-editor.math.open-delimiter')} value="$$" readOnly tabIndex={-1} className="w-6 bg-transparent text-p-purple outline-none" />
      <textarea aria-label={i18n('pages.block-editor.toolbar.equation-value')} autoFocus rows={3}
        className="min-w-0 flex-1 resize-y bg-transparent text-sm outline-none" value={latex}
        onChange={(event) => setLatex(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); apply() } }} />
      <input aria-label={i18n('pages.block-editor.math.close-delimiter')} value="$$" readOnly tabIndex={-1} className="w-6 bg-transparent text-p-purple outline-none" />
    </div>
    <Button type="submit" disabled={!latex.trim()}>{i18n('pages.block-editor.toolbar.apply')}</Button>
  </form>
}

export function EditorMathPopup({ editor, position, onPositionChange }: { editor: Editor; position: number | null; onPositionChange: (position: number | null) => void }) {
  const dismissed = useRef<number | null>(null)
  useEffect(() => {
    const selectionChanged = () => {
      const selection = editor.state.selection
      if (selection instanceof NodeSelection && isMath(selection.node.type.name)) {
        if (dismissed.current !== selection.from) onPositionChange(selection.from)
      } else dismissed.current = null
    }
    const contentChanged = ({ transaction }: { transaction: import('@tiptap/pm/state').Transaction }) => {
      if (!transaction.docChanged) return
      const selection = editor.state.selection
      if (!selection.empty) return
      const before = selection.$from.nodeBefore
      if (!before || !isMath(before.type.name)) return
      const pos = selection.from - before.nodeSize
      const oldPos = transaction.mapping.invert().map(pos)
      const oldNode = oldPos >= 0 && oldPos <= transaction.before.content.size ? transaction.before.nodeAt(oldPos) : null
      if (!isMath(oldNode?.type.name)) onPositionChange(pos)
    }
    editor.on('selectionUpdate', selectionChanged)
    editor.on('transaction', contentChanged)
    return () => { editor.off('selectionUpdate', selectionChanged); editor.off('transaction', contentChanged) }
  }, [editor, onPositionChange])
  const node = position === null ? null : editor.state.doc.nodeAt(position)
  if (position === null || !isMath(node?.type.name)) return null
  const close = () => { dismissed.current = position; onPositionChange(null) }
  const anchor = { current: { getBoundingClientRect: () => {
    const element = editor.view.nodeDOM(position)
    return element instanceof Element ? element.getBoundingClientRect() : new DOMRect()
  } } }
  return <Popover.Root open onOpenChange={(open) => { if (!open) close() }}>
    <Popover.Anchor virtualRef={anchor} />
    <Popover.Portal>
      <Popover.Content data-editor-math-popup aria-label={i18n('pages.block-editor.math.edit')} side="bottom" align="start" sideOffset={8}
        className={`${FLOATING_SURFACE_CLASSES} z-[90] p-3`} onCloseAutoFocus={(event) => event.preventDefault()}>
        <MathForm key={position} editor={editor} position={position} close={close} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
