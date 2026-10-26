import Mention from '@tiptap/extension-mention'
import { exitSuggestion } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect } from 'react'
import { displayMentionText } from 'cubs-components'
import { useOptionalMention } from '@/hooks/useMention'
import { i18n } from '@/lib/i18n'
import { formatDatetimeMention, mentionToken, type MentionOption } from '@/shared/mentions'
import { CHILD_TITLE, PDF_TITLE, pdfColumn } from '@/shared/recursive-template'
import { useEditorEnvironment } from './editorEnvironmentContext'
import { recursiveMentionOptions } from './recursiveEditor'

export const EDITOR_MENTION_PLUGIN_KEY = new PluginKey('cubsMention')

function MentionView({ node }: NodeViewProps) {
  const context = useOptionalMention()
  const id = String(node.attrs.id ?? '')
  const datetime = formatDatetimeMention(id)
  const environment = useEditorEnvironment()
  const recursive = id.startsWith('recursive:') || id.startsWith('pdf:page:')
  const recursiveColumn = environment.recursiveColumns?.find((col) => id === `recursive:child:columns.${col.id}`)
  const pdfProperty = environment.recursiveColumns?.find((col) => id === pdfColumn(col.id))
  const relationLabel = environment.recursiveRelations?.flatMap((relation) => recursiveMentionOptions(relation.columns, relation.id, relation.name)).find((option) => option.id === id)?.label
  const recursiveLabel = id === CHILD_TITLE || id === PDF_TITLE ? i18n('recursive.page-title') : relationLabel ?? pdfProperty?.name ?? (recursiveColumn ? recursiveColumn.name || i18n('recursive.unnamed-property') : undefined)
  const register = context?.register
  useEffect(() => { if (!recursive && !datetime) register?.([id]) }, [register, id, recursive, datetime])
  const label = datetime ? i18n('mentions.today') : recursive ? recursiveLabel : context?.options.find((option) => option.id === id)?.label
  return <NodeViewWrapper as="span" contentEditable={false} title={label ? displayMentionText(label, context?.resolve, i18n('mentions.unavailable')) : undefined}
    className="rounded-full bg-p-purple/10 px-2.5 py-0.5 text-p-purple" data-mention-id={id}>
    {displayMentionText(datetime ?? (recursive ? recursiveLabel ?? i18n('mentions.unavailable') : context?.values[id] ?? i18n('mentions.unavailable')), context?.resolve, i18n('mentions.unavailable'))}
  </NodeViewWrapper>
}

/** Official Mention + Suggestion handle the schema, cursor range, insertion and deletion. */
export function createEditorMention(getOptions: () => MentionOption[] = () => []) {
  const readable = (id: string) => {
    const datetime = formatDatetimeMention(id)
    if (datetime !== null) return datetime
    const option = getOptions().find((option) => option.id === id)
    return displayMentionText(option ? option.value || option.label : i18n('mentions.unavailable'), (token) => getOptions().find((entry) => mentionToken(entry.id) === token)?.value ?? i18n('mentions.unavailable'), i18n('mentions.unavailable'))
  }
  return Mention.extend({ priority: 1100, addNodeView() { return ReactNodeViewRenderer(MentionView) } }).configure({
    HTMLAttributes: { class: 'cubs-mention' },
    renderText: ({ node }) => readable(String(node.attrs.id ?? '')),
    renderHTML: ({ node, options }) => ['span', options.HTMLAttributes, readable(String(node.attrs.id ?? ''))],
    suggestion: {
      pluginKey: EDITOR_MENTION_PLUGIN_KEY,
      char: '@',
      items: ({ query }) => getOptions().filter((option) => `${option.label} ${option.search ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
      allow: ({ state, range }) => {
        const pos = state.doc.resolve(range.from)
        return pos.parent.type.name !== 'codeBlock' && !pos.marks().some((mark) => mark.type.name === 'code')
      },
      render: () => {
        let element: HTMLDivElement | null = null
        let root: Root | null = null
        let selected = 0
        let items: MentionOption[] = []
        let choose: (item: MentionOption) => void = () => undefined
        const draw = () => root?.render(<div role="listbox" aria-label={i18n('mentions.label')} className="max-h-72 w-80 max-w-[85vw] overflow-auto rounded-xl border border-divider bg-background p-1.5 shadow-xl">
          {!items.length && <p className="p-3 text-xs opacity-60">{i18n('mentions.empty')}</p>}
          {items.map((item, index) => <div key={item.id}>
            {(index === 0 || items[index - 1]!.section !== item.section) && <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide opacity-50">{item.section}</p>}
            <button ref={(element) => { if (index === selected) element?.scrollIntoView?.({ block: 'nearest' }) }} role="option" aria-selected={index === selected} type="button" onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs ${index === selected ? 'bg-p-purple/10 text-p-purple' : ''}`}>
              <span className="min-w-0 truncate">{displayMentionText(item.label)}</span><span className="max-w-28 truncate opacity-50">{displayMentionText(item.value)}</span>
            </button>
          </div>)}
        </div>)
        return {
          onStart: (props) => {
            element = document.createElement('div'); element.style.position = 'fixed'; element.style.zIndex = '100'; document.body.append(element); root = createRoot(element)
            selected = 0; items = props.items; choose = (item) => props.command({ id: item.id, label: null })
            const rect = props.clientRect?.(); if (rect) { element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 336))}px`; element.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 300))}px` }
            draw()
          },
          onUpdate: (props) => {
            selected = 0; items = props.items; choose = (item) => props.command({ id: item.id, label: null })
            const rect = props.clientRect?.(); if (rect && element) { element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 336))}px`; element.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 300))}px` }
            draw()
          },
          onKeyDown: ({ event, view }) => {
            if (event.key === 'Escape') { exitSuggestion(view, EDITOR_MENTION_PLUGIN_KEY); return true }
            if (event.key === 'Enter') { if (items[selected]) choose(items[selected]); return true }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              selected = items.length ? (selected + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length : 0
              draw(); return true
            }
            return false
          },
          onExit: () => { const previous = root; root = null; queueMicrotask(() => previous?.unmount()); element?.remove(); element = null },
        }
      },
    },
  })
}
