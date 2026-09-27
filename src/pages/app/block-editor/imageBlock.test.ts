import { Editor, type JSONContent } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'

import { createEditorExtensions } from './editorExtensions'
import { insertImageBlock, readImageAsDataUrl } from './imageBlock'

let editor: Editor | null = null

afterEach(() => {
  editor?.destroy()
  editor = null
})

function createEditor() {
  editor = new Editor({
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
                      content: [{ type: 'text', text: 'Existing block' }],
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
  return editor
}

describe('image block', () => {
  it('stores the literal base64 data URL in a dedicated image row', () => {
    const currentEditor = createEditor()
    const src = 'data:image/png;base64,iVBORw0KGgo='

    insertImageBlock(currentEditor, { src, alt: 'pasted-image.png' })

    const insertedRow = currentEditor.getJSON().content?.[0] as JSONContent | undefined
    const insertedColumn = insertedRow?.content?.[0] as JSONContent | undefined
    const insertedBlock = insertedColumn?.content?.[1] as JSONContent | undefined
    const insertedImage = insertedBlock?.content?.[0] as JSONContent | undefined
    expect(currentEditor.getJSON().content).toHaveLength(1)
    expect(insertedRow?.content).toHaveLength(1)
    expect(insertedColumn?.content).toHaveLength(2)
    expect(insertedBlock?.attrs?.kind).toBe('image')
    expect(insertedImage).toMatchObject({
      type: 'imageBlock',
      attrs: { src, alt: 'pasted-image.png', width: null },
    })
  })

  it('converts an uploaded image file to a literal data URL', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'image.png', {
      type: 'image/png',
    })

    await expect(readImageAsDataUrl(file)).resolves.toBe(
      'data:image/png;base64,AQIDBA==',
    )
  })
})
