import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'

import 'katex/dist/katex.min.css'
import './editor.css'

import { i18n } from '@/lib/i18n'

import { EditorMenus } from './EditorMenus'
import { EditorDnd } from './EditorDnd'
import { BlockInsertDock } from './BlockInsertDock'
import { createEditorExtensions } from './editorExtensions'
import { EditorEnvironmentProvider } from './EditorEnvironment'
import type { FormBlockOption } from './editorEnvironmentContext'

function createBlockId(): string {
  return crypto.randomUUID()
}

function emptyEditableBlock(): JSONContent {
  return {
    type: 'editableBlock',
    attrs: { id: createBlockId(), kind: 'richText', indent: 0 },
    content: [{ type: 'paragraph' }],
  }
}

function emptyBlockColumn(): JSONContent {
  return {
    type: 'blockColumn',
    attrs: { id: createBlockId(), span: 100 },
    content: [emptyEditableBlock()],
  }
}

function createEmptyEditorContent(): JSONContent {
  return {
    type: 'doc',
    content: [
      {
        type: 'blockRow',
        attrs: { id: createBlockId() },
        content: [emptyBlockColumn()],
      },
    ],
  }
}

export function Editor({
  content,
  forms = [],
  onChange = () => undefined,
  onOpenForm = () => undefined,
}: {
  content?: JSONContent
  forms?: FormBlockOption[]
  onChange?: (content: JSONContent) => void
  onOpenForm?: (viewId: string) => void
}) {
  const editor = useEditor({
    extensions: createEditorExtensions(),
    content: content ?? createEmptyEditorContent(),
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
    editorProps: {
      attributes: {
        'aria-label': i18n('pages.block-editor.editor.accessible-name'),
      },
    },
  })

  if (!editor) return null

  return (
    <EditorEnvironmentProvider value={{ forms, openForm: onOpenForm }}>
    <section className="cubs-editor w-full">
      <EditorDnd editor={editor}>
        <EditorContent editor={editor} />
        <BlockInsertDock editor={editor} forms={forms} />
        <EditorMenus editor={editor} />
      </EditorDnd>
    </section>
    </EditorEnvironmentProvider>
  )
}
