import { Editor as TiptapEditor } from '@tiptap/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ModalProvider } from '@/contexts/ModalContext'
import { Editor } from './Editor'
import { createEditorExtensions } from './editorExtensions'
import { CODE_LANGUAGES, codeLowlight } from './codeBlock'

const content = { type: 'doc', content: [{ type: 'blockRow', attrs: { id: 'row' }, content: [{
  type: 'blockColumn', attrs: { id: 'column', span: 100 }, content: [{
    type: 'editableBlock', attrs: { id: 'block', kind: 'codeBlock', indent: 0 }, content: [{
      type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'const value = 1;' }],
    }],
  }],
}] }] }

afterEach(cleanup)

describe('library-backed code block', () => {
  it('gets all requested language grammars from the library', () => {
    for (const language of ['csharp', 'java', 'javascript', 'typescript', 'haskell', 'prolog', 'html', 'css', 'c', 'cpp', 'python']) {
      expect(CODE_LANGUAGES.some((option) => option.value === language)).toBe(true)
      expect(codeLowlight.registered(language)).toBe(true)
    }
    expect(CODE_LANGUAGES.length).toBeGreaterThan(100)
  })
  it('shows a native language select, highlights the code and saves language changes', async () => {
    const onChange = vi.fn()
    const { container } = render(<ModalProvider><Editor content={content} onChange={onChange} /></ModalProvider>)
    const select = await screen.findByRole('combobox', { name: 'Linguagem do código' })
    expect(select.tagName).toBe('SELECT')
    expect(container.querySelector('code .hljs-keyword')?.textContent).toBe('const')
    await act(async () => fireEvent.change(select, { target: { value: 'typescript' } }))
    await waitFor(() => expect(onChange.mock.lastCall?.[0].content[0].content[0].content[0].content[0].attrs.language).toBe('typescript'))
  })
  it('inserts newlines within code and lets the library exit at the end of the block', () => {
    const editor = new TiptapEditor({ extensions: createEditorExtensions(), content })
    try {
      let position = 0
      editor.state.doc.descendants((node, pos) => { if (node.type.name === 'codeBlock') position = pos + node.nodeSize - 1 })
      editor.commands.setTextSelection(position)
      fireEvent.keyDown(editor.view.dom, { key: 'Enter' })
      expect(editor.state.doc.firstChild?.firstChild?.firstChild?.childCount).toBe(1)
      expect(editor.state.selection.$from.parent.type.name).toBe('codeBlock')
      expect(editor.state.selection.$from.parent.textContent.endsWith('\n')).toBe(true)
      fireEvent.keyDown(editor.view.dom, { key: 'ArrowDown' })
      expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    } finally { editor.destroy() }
  })
  it('keeps inline code exitable by moving the caret beyond its end', () => {
    const inline = { ...content, content: [{ ...content.content[0], content: [{ ...content.content[0].content[0], content: [{
      type: 'editableBlock', attrs: { id: 'inline', kind: 'richText', indent: 0 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'value()', marks: [{ type: 'code' }] }] }],
    }] }] }] }
    const editor = new TiptapEditor({ extensions: createEditorExtensions(), content: inline })
    try {
      let end = 0
      editor.state.doc.descendants((node, pos) => { if (node.type.name === 'paragraph') end = pos + node.nodeSize - 1 })
      editor.commands.setTextSelection(end)
      expect(editor.isActive('code')).toBe(true)
      fireEvent.keyDown(editor.view.dom, { key: 'ArrowRight' })
      expect(editor.isActive('code')).toBe(false)
    } finally { editor.destroy() }
  })
})
