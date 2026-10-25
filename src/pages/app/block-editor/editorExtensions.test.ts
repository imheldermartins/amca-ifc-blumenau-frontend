import { Editor, getSchema } from '@tiptap/core'
import { fireEvent } from '@testing-library/react'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { DecorationSet } from '@tiptap/pm/view'
import { describe, expect, it } from 'vitest'

import { createEditorExtensions, createNextBlockSeed } from './editorExtensions'
import type { EditorBlockKind } from './types'

const schema = getSchema(createEditorExtensions())

describe('focused empty line placeholder', () => {
  it.each(['heading', 'bulletList', 'taskList'])('shows the initial hint inside an empty %s line and hides it after typing', (kind) => {
    const content = kind === 'heading' ? [{ type: 'heading', attrs: { level: 2 } }]
      : [{ type: kind, content: [{ type: kind === 'taskList' ? 'taskItem' : 'listItem', content: [{ type: 'paragraph' }] }] }]
    const editor = new Editor({ extensions: createEditorExtensions(), content: { type: 'doc', content: [{ type: 'blockRow', content: [{ type: 'blockColumn', content: [{ type: 'editableBlock', attrs: { kind: kind === 'heading' ? 'richText' : kind === 'taskList' ? 'checkList' : 'bulletList' }, content }] }] }] } })
    try {
      const hints = () => editor.state.plugins.flatMap((plugin) => {
        const decorations = plugin.props.decorations?.call(plugin, editor.state)
        return decorations instanceof DecorationSet ? decorations.find() : []
      })
      expect(hints()).toHaveLength(1)
      fireEvent.focus(editor.view.dom)
      expect(hints()).toHaveLength(1)
      editor.commands.insertContent('Texto')
      expect(hints()).toHaveLength(0)
      fireEvent.blur(editor.view.dom)
      expect(hints()).toHaveLength(0)
    } finally { editor.destroy() }
  })
  it('shows from loading in an empty document, follows the selected line and never enters saved JSON', () => {
    const editor = new Editor({ extensions: createEditorExtensions(), content: {
      type: 'doc', content: [{ type: 'blockRow', attrs: { id: 'row' }, content: [{
        type: 'blockColumn', attrs: { id: 'column', span: 100 }, content: ['a', 'b'].map((id) => ({
          type: 'editableBlock', attrs: { id, kind: 'richText', indent: 0 }, content: [{ type: 'paragraph' }],
        })),
      }] }],
    } })
    try {
      const paragraphs: number[] = []
      editor.state.doc.descendants((node, position) => { if (node.type.name === 'paragraph') paragraphs.push(position + 1) })
      const json = editor.getJSON()
      const hints = () => editor.state.plugins.flatMap((plugin) => {
        const decorations = plugin.props.decorations?.call(plugin, editor.state)
        return decorations instanceof DecorationSet ? decorations.find() : []
      })
      expect(hints()).toHaveLength(1)
      editor.commands.setTextSelection(paragraphs[0]!)
      fireEvent.focus(editor.view.dom)
      expect(hints()).toHaveLength(1)
      expect(hints()[0].from).toBe(paragraphs[0]! - 1)
      editor.commands.setTextSelection(paragraphs[1]!)
      expect(hints()).toHaveLength(1)
      expect(hints()[0].from).toBe(paragraphs[1]! - 1)
      fireEvent.blur(editor.view.dom)
      expect(hints()).toHaveLength(1)
      expect(editor.getJSON()).toEqual(json)
      fireEvent.focus(editor.view.dom)
      editor.commands.insertContent('Conteúdo')
      expect(hints()).toHaveLength(0)
      editor.commands.setTextSelection(paragraphs[0]!)
      expect(hints()).toHaveLength(1)
      fireEvent.blur(editor.view.dom)
      expect(hints()).toHaveLength(0)
    } finally { editor.destroy() }
  })
})
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
