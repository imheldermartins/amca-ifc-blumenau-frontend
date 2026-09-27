import { Extension, mergeAttributes, Node, type Editor } from '@tiptap/core'
import { NodeSelection, Plugin } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'

import { ImageBlockView } from './ImageBlockView'
import {
  DEFAULT_IMAGE_COMPRESSION_PRESET,
  compressImageDataUrl,
  compressImageFile,
  type ImageCompressionPresetId,
} from './imageCompression'

export const EDITOR_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif'

interface ImageBlockAttributes {
  alt: string
  src: string
  width?: number | null
}

function ancestorDepth(editor: Editor, nodeName: string): number | null {
  const { $from } = editor.state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === nodeName) return depth
  }
  return null
}

export function insertImageBlock(editor: Editor, attrs: ImageBlockAttributes): boolean {
  const { state } = editor
  const image = state.schema.nodes.imageBlock.create(attrs)
  const block = state.schema.nodes.editableBlock.create(
    {
      id: crypto.randomUUID(),
      kind: 'image',
      indent: 0,
    },
    image,
  )
  const blockDepth = ancestorDepth(editor, 'editableBlock')

  if (blockDepth !== null) {
    const { $from } = state.selection
    const sourceBlock = $from.node(blockDepth)
    const blockStart = $from.before(blockDepth)
    const replacesEmptyBlock =
      sourceBlock.textContent.length === 0 &&
      sourceBlock.childCount === 1 &&
      sourceBlock.firstChild?.type.name === 'paragraph'
    const transaction = replacesEmptyBlock
      ? state.tr.replaceWith(blockStart, $from.after(blockDepth), block)
      : state.tr.insert($from.after(blockDepth), block)
    const imagePosition = blockStart + 1 + (replacesEmptyBlock ? 0 : sourceBlock.nodeSize)
    transaction.setSelection(NodeSelection.create(transaction.doc, imagePosition))
    editor.view.dispatch(transaction.scrollIntoView())
    return true
  }

  const insertPosition = state.doc.content.size
  const column = state.schema.nodes.blockColumn.create(
    { id: crypto.randomUUID(), span: 100 },
    block,
  )
  const row = state.schema.nodes.blockRow.create(
    { id: crypto.randomUUID() },
    column,
  )
  const transaction = state.tr.insert(insertPosition, row)
  transaction.setSelection(NodeSelection.create(transaction.doc, insertPosition + 3))
  editor.view.dispatch(transaction.scrollIntoView())
  return true
}

export function readImageAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new TypeError('The selected file is not an image.'))
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new TypeError('The image could not be converted to a data URL.'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Image reading failed.'))
    reader.readAsDataURL(file)
  })
}

export async function insertImageFile(
  editor: Editor,
  file: File,
  presetId: ImageCompressionPresetId = DEFAULT_IMAGE_COMPRESSION_PRESET,
): Promise<void> {
  const compressed = await compressImageFile(file, presetId)
  insertImageBlock(editor, { src: compressed.dataUrl, alt: file.name })
}

export async function insertImageDataUrl(
  editor: Editor,
  dataUrl: string,
  originalName: string,
  presetId: ImageCompressionPresetId = DEFAULT_IMAGE_COMPRESSION_PRESET,
): Promise<void> {
  const compressed = await compressImageDataUrl(dataUrl, presetId)
  insertImageBlock(editor, { src: compressed.dataUrl, alt: originalName })
}

function imageFileFromClipboard(data: DataTransfer): File | null {
  for (const item of data.items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) return file
  }

  return [...data.files].find((file) => file.type.startsWith('image/')) ?? null
}

function dataImageFromClipboard(data: DataTransfer): string | null {
  const html = data.getData('text/html')
  const source = html.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i)?.[1]
  return source ?? null
}

export const ImageBlock = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = Number(element.getAttribute('data-width'))
          return Number.isFinite(width) && width > 0 ? Math.round(width) : null
        },
        renderHTML: ({ width }) => (width ? { 'data-width': Math.round(width) } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure[data-type="image-block"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { 'data-type': 'image-block' }),
      ['img', { src: node.attrs.src, alt: node.attrs.alt, draggable: 'false' }],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView)
  },
})

export const ImageClipboard = Extension.create({
  name: 'imageClipboard',

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
        props: {
          handlePaste: (_view, event) => {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

            const file = imageFileFromClipboard(clipboardData)
            if (file) {
              event.preventDefault()
              void insertImageFile(editor, file).catch(console.error)
              return true
            }

            const dataUrl = dataImageFromClipboard(clipboardData)
            if (!dataUrl) return false

            event.preventDefault()
            const originalName = `pasted-image-${Date.now()}.png`
            void insertImageDataUrl(editor, dataUrl, originalName).catch(console.error)
            return true
          },
        },
      }),
    ]
  },
})
