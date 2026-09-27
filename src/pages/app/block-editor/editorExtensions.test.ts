import { Editor, getSchema } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { describe, expect, it } from 'vitest'

import { createEditorExtensions, createNextBlockSeed } from './editorExtensions'
import type { EditorBlockKind } from './types'

const schema = getSchema(createEditorExtensions())

function sourceBlock(
  kind: EditorBlockKind,
  content: ProseMirrorNode,
  indent = 2,
) {
  return schema.nodes.editableBlock.create(
    { id: 'source', kind, indent },
    content,
  )
}

describe('createNextBlockSeed', () => {
  it('converts formatted non-list blocks into an empty rich-text paragraph', () => {
    const heading = schema.nodes.heading.create(
      { level: 2 },
      schema.text('Título formatado', [schema.marks.bold.create()]),
    )

    const seed = createNextBlockSeed(sourceBlock('richText', heading, 3), schema)

    expect(seed.kind).toBe('richText')
    expect(seed.indent).toBe(0)
    expect(seed.content.toJSON()).toEqual({ type: 'paragraph' })
  })

  it.each([
    ['bulletList', 'bulletList', 'listItem'],
    ['enumerateList', 'orderedList', 'listItem'],
    ['checkList', 'taskList', 'taskItem'],
  ] as const)('preserves an empty %s block', (kind, listName, itemName) => {
    const item = schema.nodes[itemName].create(
      itemName === 'taskItem' ? { checked: true } : null,
      schema.nodes.paragraph.create(null, schema.text('Item existente')),
    )
    const list = schema.nodes[listName].create(
      listName === 'orderedList' ? { start: 4 } : null,
      item,
    )

    const seed = createNextBlockSeed(sourceBlock(kind, list), schema)

    expect(seed.kind).toBe(kind)
    expect(seed.indent).toBe(2)
    expect(seed.content.type.name).toBe(listName)
    expect(seed.content.firstChild?.type.name).toBe(itemName)
    expect(seed.content.textContent).toBe('')

    if (itemName === 'taskItem') {
      expect(seed.content.firstChild?.attrs.checked).toBe(false)
    }
  })
})

describe('new block on Enter', () => {
  it('adds the next block to the same column instead of creating another row', () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockRow',
            attrs: { id: 'row-1' },
            content: [
              {
                type: 'blockColumn',
                attrs: { id: 'column-1', span: 4 },
                content: [
                  {
                    type: 'editableBlock',
                    attrs: { id: 'block-1', kind: 'richText', indent: 0 },
                    content: [
                      {
                        type: 'heading',
                        attrs: { level: 2 },
                        content: [{ type: 'text', text: 'Heading' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    try {
      let headingPosition = 0
      editor.state.doc.descendants((node, position) => {
        if (node.type.name !== 'heading') return true
        headingPosition = position + 1
        return false
      })
      editor.commands.setTextSelection(headingPosition)
      editor.commands.keyboardShortcut('Enter')

      const row = editor.state.doc.firstChild
      const column = row?.firstChild
      expect(editor.state.doc.childCount).toBe(1)
      expect(row?.childCount).toBe(1)
      expect(column?.childCount).toBe(2)
      expect(column?.child(1).attrs.kind).toBe('richText')
      expect(column?.child(1).firstChild?.type.name).toBe('paragraph')
    } finally {
      editor.destroy()
    }
  })
})

describe('empty document invariant', () => {
  it('keeps an editable block after selecting and deleting the whole document', () => {
    const editor = new Editor({
      extensions: createEditorExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockRow',
            attrs: { id: 'row-1' },
            content: [
              {
                type: 'blockColumn',
                attrs: { id: 'column-1', span: 4 },
                content: [
                  {
                    type: 'editableBlock',
                    attrs: { id: 'block-1', kind: 'richText', indent: 0 },
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: 'Apagar tudo' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    try {
      expect(editor.schema.topNodeType.spec.content).toBe('blockRow+')
      expect(editor.commands.selectAll()).toBe(true)
      expect(editor.commands.keyboardShortcut('Backspace')).toBe(true)

      const row = editor.state.doc.firstChild
      const column = row?.firstChild
      const block = column?.firstChild
      expect(editor.state.doc.childCount).toBe(1)
      expect(row?.type.name).toBe('blockRow')
      expect(column?.type.name).toBe('blockColumn')
      expect(block?.type.name).toBe('editableBlock')
      expect(block?.firstChild?.type.name).toBe('paragraph')
      expect(row?.attrs.id).toEqual(expect.any(String))
      expect(column?.attrs.id).toEqual(expect.any(String))
      expect(block?.attrs.id).toEqual(expect.any(String))

      expect(editor.commands.insertContent('Recomeço')).toBe(true)
      expect(editor.state.doc.textContent).toBe('Recomeço')
    } finally {
      editor.destroy()
    }
  })
})

describe('text block placeholder', () => {
  it('adds the mention hint only to an empty rich-text paragraph', () => {
    const editor = new Editor({
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
              content: [{ type: 'paragraph' }],
            }],
          }],
        }],
      },
    })

    try {
      const paragraph = editor.view.dom.querySelector('p[data-placeholder]')
      expect(paragraph?.getAttribute('data-placeholder')).toBe(
        'Digite ou use @ para mencionar uma página ou membro',
      )

      editor.commands.insertContent('Conteúdo')
      expect(editor.view.dom.querySelector('p[data-placeholder]')).toBeNull()
    } finally {
      editor.destroy()
    }
  })
})
