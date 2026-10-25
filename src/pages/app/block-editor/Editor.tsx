import type { JSONContent } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/react'
import { useEffect, useRef, useState } from 'react'
import { useOptionalMention } from '@/hooks/useMention'

import 'katex/dist/katex.min.css'
import './editor.css'

import { i18n } from '@/lib/i18n'

import { EditorMenus } from './EditorMenus'
import { EditorDnd } from './EditorDnd'
import { BlockInsertDock } from './BlockInsertDock'
import { createEditorExtensions } from './editorExtensions'
import { EditorEnvironmentProvider } from './EditorEnvironment'
import { EditorMathPopup } from './EditorMathPopup'
import type { FormBlockOption } from './editorEnvironmentContext'
import { createDocumentChangeDebouncer } from './documentChanges'

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
  onChangeDeferred,
  onOpenForm = () => undefined,
}: {
  content?: JSONContent
  forms?: FormBlockOption[]
  onChange?: (content: JSONContent) => void
  onChangeDeferred?: (readContent: () => JSONContent) => void
  onOpenForm?: (viewId: string) => void
}) {
  const [mathPosition, setMathPosition] = useState<number | null>(null)
  const mentions = useOptionalMention()
  const mentionRef = useRef(mentions)
  mentionRef.current = mentions
  const changeRef = useRef(onChange)
  changeRef.current = onChange
  const changesRef = useRef<ReturnType<typeof createDocumentChangeDebouncer> | null>(null)
  if (!changesRef.current) changesRef.current = createDocumentChangeDebouncer((snapshot) => changeRef.current(snapshot))
  useEffect(() => () => changesRef.current?.flush(), [])
  const editor = useEditor({
    extensions: createEditorExtensions({ onMathClick: setMathPosition, mentionOptions: () => mentionRef.current?.options ?? [] }),
    content: content ?? createEmptyEditorContent(),
    onUpdate: ({ editor: current }) => {
      const readContent = () => current.getJSON()
      if (onChangeDeferred) onChangeDeferred(readContent)
      else changesRef.current!.schedule(readContent)
    },
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
        <EditorMathPopup editor={editor} position={mathPosition} onPositionChange={setMathPosition} />
      </EditorDnd>
    </section>
    </EditorEnvironmentProvider>
  )
}
