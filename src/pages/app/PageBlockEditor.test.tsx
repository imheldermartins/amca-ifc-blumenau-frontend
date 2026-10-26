import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { JSONContent } from '@tiptap/core'
import { createRef } from 'react'

import { FeedbackProvider } from '@/contexts/FeedbackContext'
import { PageBlockEditor, type PageBlockEditorHandle } from './PageBlockEditor'

const api = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), snapshot: vi.fn() }))
vi.mock('@/services/PageDocumentService', () => ({ pageDocumentService: api }))
vi.mock('@/services/PagePdfService', () => ({ pagePdfService: { catalog: async () => ({ children: [], columns: [] }) } }))
vi.mock('@/hooks/useModal', () => ({ useModal: () => ({ openModal: vi.fn() }) }))
vi.mock('./block-editor/Editor', () => ({
  Editor: ({ onChange, onChangeDeferred }: { onChange: (content: JSONContent) => void; onChangeDeferred?: (read: () => JSONContent) => void }) => <>
    <button type="button" onClick={() => onChange({ type: 'doc', content: [{ type: 'paragraph' }] })}>Editar conteúdo</button>
    <button type="button" onClick={() => onChangeDeferred?.(api.snapshot)}>Digitar conteúdo</button>
  </>,
}))

function deferred() {
  let resolve!: (value: unknown) => void
  let reject!: (error: Error) => void
  const promise = new Promise((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

async function setup() {
  const editorRef = createRef<PageBlockEditorHandle>()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  for (const id of ['page-1', 'page-2']) client.setQueryData(['page-document', id], { content: null, revision: 1 })
  const tree = (pageId: string) => <QueryClientProvider client={client}><FeedbackProvider>
    <PageBlockEditor ref={editorRef} pageId={pageId} />
  </FeedbackProvider></QueryClientProvider>
  const mounted = render(tree('page-1'))
  await screen.findByRole('button', { name: 'Editar conteúdo' })
  vi.useFakeTimers()
  return { ...mounted, editorRef, switchPage: () => mounted.rerender(tree('page-2')) }
}

beforeEach(() => {
  vi.clearAllMocks()
  api.save.mockReset().mockResolvedValue({ content: null, revision: 2 })
  api.snapshot.mockReturnValue({ type: 'doc', content: [{ type: 'paragraph' }] })
})
afterEach(async () => {
  await act(async () => cleanup())
  vi.useRealTimers()
})

describe('PageBlockEditor save feedback', () => {
  it('flushes pending edits for the page menu export and propagates a save failure', async () => {
    const { editorRef } = await setup()
    expect(screen.queryByRole('button', { name: 'Gerar PDF' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Digitar conteúdo' }))
    expect(api.save).not.toHaveBeenCalled()
    await act(async () => { await editorRef.current!.flush() })
    expect(api.save).toHaveBeenCalledOnce()
    expect(editorRef.current!.pageId).toBe('page-1')
    await act(async () => vi.advanceTimersByTimeAsync(600))
    expect(api.save).toHaveBeenCalledOnce()
    api.save.mockRejectedValueOnce(new Error('offline'))
    await act(async () => { await expect(editorRef.current!.flush()).rejects.toThrow('offline') })
  })
  it('waits for idle before reading the editor JSON and does not save it again on unmount', async () => {
    const view = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Digitar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(400))
    fireEvent.click(screen.getByRole('button', { name: 'Digitar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(599))
    expect(api.snapshot).not.toHaveBeenCalled(); expect(api.save).not.toHaveBeenCalled()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(api.snapshot).toHaveBeenCalledOnce(); expect(api.save).toHaveBeenCalledOnce()
    await act(async () => view.unmount())
    expect(api.save).toHaveBeenCalledOnce()
  })
  it('keeps the debounce and reports a successful save through the global toaster', async () => {
    await setup()
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(400))
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(599))
    expect(api.save).not.toHaveBeenCalled()
    expect(screen.queryByText('Salvando…')).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(1))
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(api.save).toHaveBeenCalledWith('page-1', expect.objectContaining({ type: 'doc' }))
    expect(screen.getByRole('status').textContent).toContain('Conteúdo salvo')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })

  it('reports a save failure through the toaster and can save a subsequent edit', async () => {
    api.save.mockRejectedValueOnce(new Error('offline'))
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(600))
    expect(screen.getByRole('status').textContent).toContain('Não foi possível salvar o conteúdo')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('assertive')
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(600))
    expect(screen.getByText('Conteúdo salvo')).toBeTruthy()
  })

  it.each(['success', 'error'])('ignores a stale %s response when newer content is pending', async (outcome) => {
    const request = deferred()
    api.save.mockReturnValueOnce(request.promise)
    await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(600))
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => {
      if (outcome === 'success') request.resolve({ revision: 2 })
      else request.reject(new Error('old response'))
    })
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(600))
    expect(screen.getByText('Conteúdo salvo')).toBeTruthy()
  })

  it.each(['success', 'error'])('does not toast a late %s from the previous page', async (outcome) => {
    const request = deferred()
    api.save.mockReturnValueOnce(request.promise)
    const view = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => vi.advanceTimersByTimeAsync(600))
    view.switchPage()
    await act(async () => {
      if (outcome === 'success') request.resolve({ revision: 2 })
      else request.reject(new Error('old page'))
    })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('flushes pending content silently on unmount', async () => {
    const view = await setup()
    fireEvent.click(screen.getByRole('button', { name: 'Editar conteúdo' }))
    await act(async () => view.unmount())
    expect(api.save).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTimeAsync(600))
    expect(api.save).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
