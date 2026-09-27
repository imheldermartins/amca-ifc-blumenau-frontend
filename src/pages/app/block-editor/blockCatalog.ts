import type { Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'

import { DEFAULT_IMAGE_COMPRESSION_PRESET } from './imageCompression'
import type { EditorBlockKind } from './types'

export type EditorBlockOptionId =
  | 'text'
  | 'image'
  | 'bullet-list'
  | 'numbered-list'
  | 'check-list'

export type EditorBlockContentPreset =
  | 'paragraph'
  | 'bulletList'
  | 'orderedList'
  | 'taskList'

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
} as const satisfies Record<EditorBlockOptionId, EditorBlockOption>

export const EDITOR_BLOCK_OPTION_IDS = [
  'text',
  'image',
  'bullet-list',
  'numbered-list',
  'check-list',
] as const satisfies readonly EditorBlockOptionId[]

export const DEFAULT_EDITOR_BLOCK_OPTION_ID: EditorBlockOptionId = 'text'

const EDITOR_BLOCK_OPTION_BY_KIND: Record<EditorBlockKind, EditorBlockOptionId> = {
  richText: 'text',
  image: 'image',
  bulletList: 'bullet-list',
  enumerateList: 'numbered-list',
  checkList: 'check-list',
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
