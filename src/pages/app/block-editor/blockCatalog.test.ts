import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_EDITOR_BLOCK_OPTION_ID,
  EDITOR_BLOCK_OPTIONS,
  insertBlockFromCatalog,
} from './blockCatalog'
import { createEditorExtensions } from './editorExtensions'

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

function createEditor(text = 'Bloco atual') {
  editor = new Editor({
    extensions: createEditorExtensions(),
    content: {
      type: 'doc',
      content: [{
        type: 'blockRow',
        attrs: { id: 'row-1' },
        content: [{
          type: 'blockColumn',
          attrs: { id: 'column-1', span: 100 },
          content: [{
            type: 'editableBlock',
            attrs: { id: 'block-1', kind: 'richText', indent: 0 },
            content: [{
              type: 'paragraph',
              content: text ? [{ type: 'text', text }] : undefined,
            }],
          }],
        }],
      }],
    },
  })
  editor.commands.focus('end')
  return editor
}

describe('editor block catalog', () => {
  it('mantém texto como ação padrão e a imagem inline em base64', () => {
    expect(DEFAULT_EDITOR_BLOCK_OPTION_ID).toBe('text')
    expect(EDITOR_BLOCK_OPTIONS.image.payload).toMatchObject({
      action: 'select-image',
      image: {
        compressionPreset: 'aggressive',
        encoding: 'data-url',
        storage: 'inline-base64',
      },
    })
  })

  it.each([
    ['text', 'richText', 'paragraph'],
    ['bullet-list', 'bulletList', 'bulletList'],
    ['numbered-list', 'enumerateList', 'orderedList'],
    ['check-list', 'checkList', 'taskList'],
  ] as const)('insere %s depois do bloco atual', (optionId, kind, nodeType) => {
    const currentEditor = createEditor()

    expect(insertBlockFromCatalog(currentEditor, optionId)).toBe(true)

    const column = currentEditor.state.doc.firstChild?.firstChild
    expect(column?.childCount).toBe(2)
    expect(column?.child(1).attrs.kind).toBe(kind)
    expect(column?.child(1).firstChild?.type.name).toBe(nodeType)
  })

  it('reaproveita o placeholder vazio em vez de criar dois blocos invisíveis', () => {
    const currentEditor = createEditor('')

    insertBlockFromCatalog(currentEditor, 'bullet-list')

    const column = currentEditor.state.doc.firstChild?.firstChild
    expect(column?.childCount).toBe(1)
    expect(column?.firstChild?.attrs.kind).toBe('bulletList')
  })
})
