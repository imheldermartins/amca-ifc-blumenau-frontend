import Mention from '@tiptap/extension-mention'
import { exitSuggestion } from '@tiptap/suggestion'
import { PluginKey } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect } from 'react'
import { useOptionalMention } from '@/hooks/useMention'
import { i18n } from '@/lib/i18n'
import { mentionToken, type MentionOption } from '@/shared/mentions'

export const EDITOR_MENTION_PLUGIN_KEY = new PluginKey('cubsMention')

function MentionView({ node }: NodeViewProps) {
  const context = useOptionalMention()
  const id = String(node.attrs.id ?? '')
  useEffect(() => { context?.register([id]) }, [context?.register, id])
  const label = context?.options.find((option) => option.id === id)?.label
  return <NodeViewWrapper as="span" contentEditable={false} title={label}
    className="rounded-full bg-p-purple/10 px-2.5 py-0.5 text-p-purple" data-mention-id={id}>
    {context?.values[id] ?? i18n('mentions.unavailable')}
  </NodeViewWrapper>
}

/** Official Mention + Suggestion handle the schema, cursor range, insertion and deletion. */
export function createEditorMention(getOptions: () => MentionOption[] = () => []) {
  return Mention.extend({ priority: 1100, addNodeView() { return ReactNodeViewRenderer(MentionView) } }).configure({
    HTMLAttributes: { class: 'cubs-mention' },
    renderText: ({ node }) => mentionToken(String(node.attrs.id ?? '')),
    suggestion: {
      pluginKey: EDITOR_MENTION_PLUGIN_KEY,
      char: '@',
      items: ({ query }) => getOptions().filter((option) => `${option.label} ${option.search ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).slice(0, 50),
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
            <button role="option" aria-selected={index === selected} type="button" onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)} className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs ${index === selected ? 'bg-p-purple/10 text-p-purple' : ''}`}>
              <span className="min-w-0 truncate">{item.label}</span><span className="max-w-28 truncate opacity-50">{item.value}</span>
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
