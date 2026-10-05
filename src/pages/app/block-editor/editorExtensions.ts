import { Extension, mergeAttributes, Node, type Editor } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Mathematics } from '@tiptap/extension-mathematics'
import { Color, TextStyle } from '@tiptap/extension-text-style'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { Plugin, Selection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

import { i18n } from '@/lib/i18n'

import { ColumnLayoutRules } from './columnLayoutRules'
import {
  BlockColumnView,
  BlockRowView,
  CalloutView,
  EditableBlockView,
} from './EditorNodeViews'
import { ImageBlock, ImageClipboard } from './imageBlock'
import type { EditorBlockKind } from './types'

const BLOCK_KINDS = new Set<EditorBlockKind>([
  'richText',
  'bulletList',
  'enumerateList',
  'checkList',
  'image',
  'formSubmit',
])

function normalizeIndent(value: unknown): number {
  const indent = Number(value)
  if (!Number.isFinite(indent)) return 0
  return Math.min(3, Math.max(0, Math.round(indent)))
}

function normalizeKind(value: unknown): EditorBlockKind {
  return typeof value === 'string' && BLOCK_KINDS.has(value as EditorBlockKind)
    ? (value as EditorBlockKind)
    : 'richText'
}

function ancestorDepth(editor: Editor, nodeName: string): number | null {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === nodeName) return depth
  }
  return null
}

export function adjustCurrentBlockIndent(editor: Editor, delta: number): boolean {
  const blockDepth = ancestorDepth(editor, 'editableBlock')
  if (blockDepth === null) return false

  const { $from } = editor.state.selection
  const block = $from.node(blockDepth)
  const kind = normalizeKind(block.attrs.kind)
  if (kind !== 'bulletList' && kind !== 'enumerateList' && kind !== 'checkList') {
    return false
  }

  const indent = normalizeIndent(block.attrs.indent)
  const nextIndent = normalizeIndent(indent + delta)
  if (nextIndent === indent) return true

  editor.view.dispatch(
    editor.state.tr.setNodeMarkup($from.before(blockDepth), undefined, {
      ...block.attrs,
      indent: nextIndent,
    }),
  )
  return true
}

function emptyParagraph(schema: Schema) {
  return schema.nodes.paragraph.create()
}

export interface NextBlockSeed {
  content: ProseMirrorNode
  indent: number
  kind: EditorBlockKind
}

export function createNextBlockSeed(
  source: ProseMirrorNode,
  schema: Schema,
): NextBlockSeed {
  const kind = normalizeKind(source.attrs.kind)
  const sourceContent = source.firstChild
  const indent = normalizeIndent(source.attrs.indent)

  if (kind === 'bulletList') {
    return {
      kind,
      indent,
      content: schema.nodes.bulletList.create(
        sourceContent?.type.name === 'bulletList' ? sourceContent.attrs : null,
        schema.nodes.listItem.create(null, emptyParagraph(schema)),
      ),
    }
  }

  if (kind === 'enumerateList') {
    return {
      kind,
      indent,
      content: schema.nodes.orderedList.create(
        sourceContent?.type.name === 'orderedList' ? sourceContent.attrs : null,
        schema.nodes.listItem.create(null, emptyParagraph(schema)),
      ),
    }
  }

  if (kind === 'checkList') {
    return {
      kind,
      indent,
      content: schema.nodes.taskList.create(
        sourceContent?.type.name === 'taskList' ? sourceContent.attrs : null,
        schema.nodes.taskItem.create({ checked: false }, emptyParagraph(schema)),
      ),
    }
  }

  return {
    kind: 'richText',
    indent: 0,
    content: emptyParagraph(schema),
  }
}

function insertBlockAfterCurrentItem(editor: Editor): boolean {
  const blockDepth = ancestorDepth(editor, 'editableBlock')
  const columnDepth = ancestorDepth(editor, 'blockColumn')
  if (blockDepth === null || columnDepth === null) return false

  const { state } = editor
  const { $from } = state.selection
  const sourceBlock = $from.node(blockDepth)
  const blockEnd = $from.after(blockDepth)
  const nextBlockSeed = createNextBlockSeed(sourceBlock, state.schema)
  const newBlock = sourceBlock.type.create(
    {
      ...sourceBlock.attrs,
      id: crypto.randomUUID(),
      kind: nextBlockSeed.kind,
      indent: nextBlockSeed.indent,
    },
    nextBlockSeed.content,
  )

  const transaction = state.tr.deleteSelection()
  const insertPosition = transaction.mapping.map(blockEnd)
  transaction.insert(insertPosition, newBlock)
  transaction.setSelection(Selection.near(transaction.doc.resolve(insertPosition + 1), 1))
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}

const NewBlockOnEnter = Extension.create({
  name: 'newBlockOnEnter',
  priority: 1_000,

  addKeyboardShortcuts() {
    return {
      Enter: () => insertBlockAfterCurrentItem(this.editor),
      Tab: () => adjustCurrentBlockIndent(this.editor, 1),
      'Shift-Tab': () => adjustCurrentBlockIndent(this.editor, -1),
    }
  },
})

const BlockDocument = Node.create({
  name: 'doc',
  topNode: true,
  content: 'blockRow+',
})

const STRUCTURAL_NODES = new Set(['blockRow', 'blockColumn', 'editableBlock'])

const BlockIdentity = Extension.create({
  name: 'blockIdentity',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((transaction) => transaction.docChanged)) return null

          const transaction = newState.tr
          let changed = false
          newState.doc.descendants((node, position) => {
            const id = node.attrs.id
            if (
              !STRUCTURAL_NODES.has(node.type.name) ||
              (typeof id === 'string' && id.length > 0)
            ) {
              return
            }

            transaction.setNodeMarkup(position, undefined, {
              ...node.attrs,
              id: crypto.randomUUID(),
            })
            changed = true
          })

          return changed ? transaction : null
        },
      }),
    ]
  },
})

const TextBlockPlaceholder = Extension.create({
  name: 'textBlockPlaceholder',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = []
            state.doc.descendants((node, position, parent) => {
              if (
                node.type.name !== 'paragraph' ||
                node.content.size > 0 ||
                parent?.type.name !== 'editableBlock' ||
                normalizeKind(parent.attrs.kind) !== 'richText'
              ) {
                return
              }

              decorations.push(Decoration.node(position, position + node.nodeSize, {
                class: 'cubs-editor-text-placeholder',
                'data-placeholder': i18n(
                  'pages.block-editor.editor.text-placeholder',
                ),
              }))
            })
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

export const BlockRow = Node.create({
  name: 'blockRow',
  group: 'block',
  content: 'blockColumn{1,4}',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-row-id'),
        renderHTML: ({ id }) => (id ? { 'data-row-id': id } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-editor-row]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-editor-row': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockRowView, { trackNodeViewPosition: true })
  },
})

export const BlockColumn = Node.create({
  name: 'blockColumn',
  group: 'column',
  content: 'editableBlock+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-column-id'),
        renderHTML: ({ id }) => (id ? { 'data-column-id': id } : {}),
      },
      span: {
        default: ColumnLayoutRules.totalPercent,
        parseHTML: (element) => ColumnLayoutRules.storedWidth(
          element.getAttribute('data-column-width')
            ?? element.getAttribute('data-column-span'),
        ),
        renderHTML: ({ span }) => ({
          'data-column-width': ColumnLayoutRules.storedWidth(span),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-editor-column]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-editor-column': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockColumnView, { trackNodeViewPosition: true })
  },
})

export const EditableBlock = Node.create({
  name: 'editableBlock',
  group: 'blockItem',
  content:
    '(paragraph|heading|bulletList|orderedList|taskList|blockquote|codeBlock|horizontalRule|callout|imageBlock)+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-block-id'),
        renderHTML: ({ id }) => (id ? { 'data-block-id': id } : {}),
      },
      kind: {
        default: 'richText',
        parseHTML: (element) => element.getAttribute('data-block-kind') ?? 'richText',
        renderHTML: ({ kind }) => ({ 'data-block-kind': normalizeKind(kind) }),
      },
      indent: {
        default: 0,
        parseHTML: (element) => normalizeIndent(element.getAttribute('data-block-indent')),
        renderHTML: ({ indent }) => ({ 'data-block-indent': normalizeIndent(indent) }),
      },
      formViewId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-form-view-id'),
        renderHTML: ({ formViewId }) => formViewId ? { 'data-form-view-id': formViewId } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-editor-block]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', mergeAttributes(HTMLAttributes, { 'data-editor-block': '' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditableBlockView, { trackNodeViewPosition: true })
  },
})

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'aside[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['aside', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },
})

export function createEditorExtensions() {
  return [
    StarterKit.configure({
      document: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, defaultProtocol: 'https' },
      trailingNode: false,
      dropcursor: false,
    }),
    BlockDocument,
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: {
        checkboxLabel: (node, checked) =>
          i18n(
            checked
              ? 'pages.block-editor.editor.uncheck-item'
              : 'pages.block-editor.editor.check-item',
            { item: node.textContent },
          ),
      },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Mathematics.configure({ katexOptions: { throwOnError: false } }),
    BlockRow,
    BlockColumn,
    EditableBlock,
    Callout,
    ImageBlock,
    ImageClipboard,
    BlockIdentity,
    TextBlockPlaceholder,
    NewBlockOnEnter,
  ]
}
