import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Editor as TiptapEditor } from '@tiptap/core'
import { Editor } from './Editor'
import { ModalProvider } from '@/contexts/ModalContext'
import { MentionProvider, type MentionContextValue } from '@/hooks/useMention'
import { createEditorExtensions } from './editorExtensions'
import { encodePageDocument, decodePageDocument } from '@/shared/page-document-codec'
import { mentionToken } from '@/shared/mentions'
import { CHILD_TITLE } from '@/shared/recursive-template'
import { recursiveMentionOptions } from './recursiveEditor'

const id = 'workspace:01M00000000000000000000001:data.campaign'
const content = { type: 'doc', content: [{ type: 'blockRow', attrs: { id: 'r' }, content: [{ type: 'blockColumn', attrs: { id: 'c', span: 100 }, content: [{ type: 'editableBlock', attrs: { id: 'b', kind: 'richText' }, content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id, label: null, mentionSuggestionChar: '@' } }] }] }] }] }] }
afterEach(cleanup)
describe('official Tiptap mentions', () => {
  it('copies readable text in plain and HTML formats while preserving the typed HTML reference', () => {
    const extensions = () => createEditorExtensions({ mentionOptions: () => [{ id, label: 'Campanha', value: 'Outono', section: 'Workspace' }] })
    const editor = new TiptapEditor({ extensions: extensions(), content })
    const html = editor.getHTML()
    const element = document.createElement('div'); element.innerHTML = html
    expect(element.textContent).toBe('Outono')
    expect(editor.getText()).toContain('Outono')
    const restored = new TiptapEditor({ extensions: extensions(), content: html })
    expect(JSON.stringify(restored.getJSON())).toContain(`"id":"${id}"`)
    restored.destroy(); editor.destroy()
  })
  it('shows a friendly Recursive title in the menu, chip and tooltip while retaining its reference', async () => {
    const recursive = structuredClone(content)
    recursive.content[0]!.content[0]!.content[0]!.content[0]!.content[0]!.attrs.id = CHILD_TITLE
    expect(recursiveMentionOptions([])[0]).toMatchObject({ id: CHILD_TITLE, label: 'Título do item relacionado' })
    const changed = vi.fn()
    render(<ModalProvider><Editor content={recursive} hasChildren onChange={changed} /></ModalProvider>)
    const chip = await screen.findByText('Título da página do PDF')
    expect(chip.getAttribute('title')).toBe('Título da página do PDF')
    expect(chip.getAttribute('data-mention-id')).toBe(CHILD_TITLE)
    expect(screen.queryByText('pageChild.title')).toBeNull()
    expect(changed).not.toHaveBeenCalled()
  })
  it('selects the suggestion with Enter before the new-block shortcut can consume it', async () => {
    const blank = structuredClone(content)
    blank.content[0]!.content[0]!.content[0]!.content[0]!.content = []
    const element = document.createElement('div'); document.body.append(element)
    const editor = new TiptapEditor({ element, extensions: createEditorExtensions({ mentionOptions: () => [{ id, label: 'Campanha', value: 'Outono', section: 'Workspace' }] }), content: blank })
    try {
      await act(async () => { fireEvent.focus(editor.view.dom); editor.commands.insertContent('@') })
      await screen.findByRole('option', { name: 'Campanha Outono' })
      const range = document.createRange(); range.selectNodeContents(editor.view.dom); range.collapse(false)
      window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
      await act(async () => { fireEvent.keyDown(editor.view.dom, { key: 'Enter' }) })
      expect(JSON.stringify(editor.getJSON())).toContain(`"id":"${id}"`)
      let blocks = 0; editor.state.doc.descendants((node) => { if (node.type.name === 'editableBlock') blocks++ })
      expect(blocks).toBe(1)
    } finally { await act(async () => editor.destroy()); element.remove() }
  })
  it('stores an atomic reference through the compact codec without exposing its token when copied', () => {
    const editor = new TiptapEditor({ extensions: createEditorExtensions(), content })
    const saved = editor.getJSON()
    expect(editor.getText()).not.toContain(mentionToken(id))
    expect(decodePageDocument(encodePageDocument(saved))).toEqual(saved)
    expect(JSON.stringify(saved)).not.toContain('Outono')
    editor.destroy()
  })
  it('renders new values from context without writing a snapshot back to the document', async () => {
    const register = vi.fn(), changed = vi.fn()
    const value = (text: string): MentionContextValue => ({ mentions: {}, addMentionsGroup: vi.fn(), options: [], values: { [id]: text }, scope: {}, loading: false, register, resolve: (text) => text })
    const tree = (text: string) => <MentionProvider value={value(text)}><ModalProvider><Editor content={content} onChange={changed} /></ModalProvider></MentionProvider>
    const view = render(tree('Outono')); await screen.findByText('Outono')
    view.rerender(tree('Verão')); await screen.findByText('Verão')
    expect(register).toHaveBeenCalledWith([id]); expect(changed).not.toHaveBeenCalled()
  })
})
