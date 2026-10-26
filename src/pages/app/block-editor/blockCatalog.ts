import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'

import { DEFAULT_IMAGE_COMPRESSION_PRESET } from './imageCompression'
import type { EditorBlockKind } from './types'
import { defaultRecursiveConfig } from '@/shared/recursive-template'

export type EditorBlockOptionId =
  | 'text'
  | 'image'
  | 'bullet-list'
  | 'numbered-list'
  | 'check-list'
  | 'math-block'
  | 'code-block'
  | 'table-recursive'
  | 'calendar-recursive'

export type EditorBlockContentPreset =
  | 'paragraph'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'
  | 'blockMath'
  | 'codeBlock'

export interface EditorBlockPayloadPreset {
  action: 'insert' | 'select-image'
  kind: EditorBlockKind
  content?: EditorBlockContentPreset
  attrs: {
    indent: number
  }
  image?: {
    compressionPreset: typeof DEFAULT_IMAGE_COMPRESSION_PRESET
    encoding: 'data-url'
    storage: 'inline-base64'
  }
}

export interface EditorBlockOption {
  id: EditorBlockOptionId
  icon: string
  labelKey: string
  descriptionKey: string
  payload: EditorBlockPayloadPreset
}

/**
 * Catálogo único da dock e da modal. Novos tipos entram aqui com seu payload;
 * as duas superfícies apenas projetam esta configuração.
 */
export const EDITOR_BLOCK_OPTIONS = {
  'table-recursive': { id: 'table-recursive', icon: 'lucide:table', labelKey: 'recursive.table', descriptionKey: 'recursive.table-description', payload: { action: 'insert', kind: 'tableRecursive', content: 'paragraph', attrs: { indent: 0 } } },
  'calendar-recursive': { id: 'calendar-recursive', icon: 'lucide:calendar-days', labelKey: 'recursive.calendar', descriptionKey: 'recursive.calendar-description', payload: { action: 'insert', kind: 'calendarRecursive', content: 'paragraph', attrs: { indent: 0 } } },
  text: {
    id: 'text',
    icon: 'lucide:text-cursor-input',
    labelKey: 'pages.block-editor.blocks.rich-text',
    descriptionKey: 'pages.block-editor.block-library.descriptions.text',
    payload: {
      action: 'insert',
      kind: 'richText',
      content: 'paragraph',
      attrs: { indent: 0 },
    },
  },
  image: {
    id: 'image',
    icon: 'lucide:image-up',
    labelKey: 'pages.block-editor.blocks.image',
    descriptionKey: 'pages.block-editor.block-library.descriptions.image',
    payload: {
      action: 'select-image',
      kind: 'image',
      attrs: { indent: 0 },
      image: {
        compressionPreset: DEFAULT_IMAGE_COMPRESSION_PRESET,
        encoding: 'data-url',
        storage: 'inline-base64',
      },
    },
  },
  'bullet-list': {
    id: 'bullet-list',
    icon: 'lucide:list',
    labelKey: 'pages.block-editor.blocks.bullet-list',
    descriptionKey: 'pages.block-editor.block-library.descriptions.bullet-list',
    payload: {
      action: 'insert',
      kind: 'bulletList',
      content: 'bulletList',
      attrs: { indent: 0 },
    },
  },
  'numbered-list': {
    id: 'numbered-list',
    icon: 'lucide:list-ordered',
    labelKey: 'pages.block-editor.blocks.enumerate-list',
    descriptionKey: 'pages.block-editor.block-library.descriptions.numbered-list',
    payload: {
      action: 'insert',
      kind: 'enumerateList',
      content: 'orderedList',
      attrs: { indent: 0 },
    },
  },
  'check-list': {
    id: 'check-list',
    icon: 'lucide:list-checks',
    labelKey: 'pages.block-editor.blocks.check-list',
    descriptionKey: 'pages.block-editor.block-library.descriptions.check-list',
    payload: {
      action: 'insert',
      kind: 'checkList',
      content: 'taskList',
      attrs: { indent: 0 },
    },
  },
  'math-block': {
    id: 'math-block', icon: 'lucide:sigma', labelKey: 'pages.block-editor.blocks.math-block',
    descriptionKey: 'pages.block-editor.block-library.descriptions.math-block',
    payload: { action: 'insert', kind: 'mathBlock', content: 'blockMath', attrs: { indent: 0 } },
  },
  'code-block': {
    id: 'code-block', icon: 'lucide:code', labelKey: 'pages.block-editor.blocks.code-block',
    descriptionKey: 'pages.block-editor.block-library.descriptions.code-block',
    payload: { action: 'insert', kind: 'codeBlock', content: 'codeBlock', attrs: { indent: 0 } },
  },
} as const satisfies Record<EditorBlockOptionId, EditorBlockOption>

export const EDITOR_BLOCK_OPTION_IDS = [
  'text',
  'image',
  'bullet-list',
  'numbered-list',
  'check-list',
  'math-block',
  'code-block',
  'table-recursive',
  'calendar-recursive',
] as const satisfies readonly EditorBlockOptionId[]

export const DEFAULT_EDITOR_BLOCK_OPTION_ID: EditorBlockOptionId = 'text'

export const EDITOR_BLOCK_SECTIONS: { labelKey: string; options: EditorBlockOptionId[] }[] = [
  { labelKey: 'recursive.section', options: ['table-recursive', 'calendar-recursive'] },
  { labelKey: 'pages.block-editor.block-library.sections.text', options: ['text', 'bullet-list', 'numbered-list', 'check-list'] },
  { labelKey: 'pages.block-editor.block-library.sections.technical', options: ['math-block', 'code-block'] },
  { labelKey: 'pages.block-editor.block-library.sections.media', options: ['image'] },
]

const EDITOR_BLOCK_OPTION_BY_KIND: Record<EditorBlockKind, EditorBlockOptionId> = {
  richText: 'text',
  image: 'image',
  bulletList: 'bullet-list',
  enumerateList: 'numbered-list',
  checkList: 'check-list',
  mathBlock: 'math-block',
  codeBlock: 'code-block',
  tableRecursive: 'table-recursive',
  calendarRecursive: 'calendar-recursive',
}

export function editorBlockOptionForKind(kind: string): EditorBlockOption {
  const optionId = EDITOR_BLOCK_OPTION_BY_KIND[kind as EditorBlockKind]
    ?? DEFAULT_EDITOR_BLOCK_OPTION_ID
  return EDITOR_BLOCK_OPTIONS[optionId]
}

const CONTENT_BUILDERS: Record<
  EditorBlockContentPreset,
  (schema: Schema) => ProseMirrorNode
> = {
  blockMath: (schema) => schema.nodes.blockMath.create({ latex: 'x^2' }),
  codeBlock: (schema) => schema.nodes.codeBlock.create({ language: 'plaintext' }),
  paragraph: (schema) => schema.nodes.paragraph.create(),
  bulletList: (schema) => schema.nodes.bulletList.create(
    null,
    schema.nodes.listItem.create(null, schema.nodes.paragraph.create()),
  ),
  orderedList: (schema) => schema.nodes.orderedList.create(
    null,
    schema.nodes.listItem.create(null, schema.nodes.paragraph.create()),
  ),
  taskList: (schema) => schema.nodes.taskList.create(
    null,
    schema.nodes.taskItem.create(
      { checked: false },
      schema.nodes.paragraph.create(),
    ),
  ),
}

function editableBlockDepth(editor: Editor): number | null {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'editableBlock') return depth
  }
  return null
}

function isEmptyTextBlock(node: ProseMirrorNode): boolean {
  return (
    node.attrs.kind === 'richText' &&
    node.textContent.length === 0 &&
    node.childCount === 1 &&
    node.firstChild?.type.name === 'paragraph'
  )
}

export function insertBlockFromCatalog(
  editor: Editor,
  optionId: EditorBlockOptionId,
): boolean {
  const option = EDITOR_BLOCK_OPTIONS[optionId]
  if (option.payload.action !== 'insert') return false
  const contentPreset = option.payload.content

  const { state } = editor
  const depth = editableBlockDepth(editor)
  if (depth === null) return false

  const { $from } = state.selection
  const sourceBlock = $from.node(depth)
  const sourceStart = $from.before(depth)
  const replaceCurrent = isEmptyTextBlock(sourceBlock)
  const insertionPosition = replaceCurrent ? sourceStart : $from.after(depth)
  const block = state.schema.nodes.editableBlock.create(
    {
      id: crypto.randomUUID(),
      kind: option.payload.kind,
      ...(['tableRecursive', 'calendarRecursive'].includes(option.payload.kind) ? { recursive: defaultRecursiveConfig() } : {}),
      ...option.payload.attrs,
    },
    CONTENT_BUILDERS[contentPreset](state.schema),
  )
  const transaction = replaceCurrent
    ? state.tr.replaceWith(sourceStart, $from.after(depth), block)
    : state.tr.insert(insertionPosition, block)
  transaction.setSelection(
    Selection.near(transaction.doc.resolve(insertionPosition + 1), 1),
  )
  editor.view.dispatch(transaction.scrollIntoView())
  editor.commands.focus()
  return true
}
