import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PdfPreview from './PdfPreview'
const pdfjs = vi.hoisted(() => ({ getDocument: vi.fn(), destroy: vi.fn(async () => {}), getPage: vi.fn(), render: vi.fn(), cancel: vi.fn() }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: { workerSrc: '' }, getDocument: pdfjs.getDocument }))
const file = { arrayBuffer: async () => new Uint8Array([37, 80, 68, 70]).buffer } as Blob
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({}) as CanvasRenderingContext2D)
  pdfjs.render.mockReturnValue({ promise: Promise.resolve(), cancel: pdfjs.cancel })
  pdfjs.getPage.mockResolvedValue({ getViewport: () => ({ width: 100, height: 150 }), render: pdfjs.render })
  pdfjs.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 2, getPage: pdfjs.getPage }), destroy: pdfjs.destroy })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.clearAllMocks() })
describe('PDF canvas preview lifecycle', () => {
  it('renders every page and destroys the document when closed', async () => {
    const view = render(<PdfPreview file={file} />)
    await waitFor(() => expect(view.container.querySelector('[data-pdf-pages="2"]')).toBeTruthy())
    expect(screen.getByRole('img', { name: 'Página 1 de 2' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Página 2 de 2' })).toBeTruthy()
    expect(pdfjs.render).toHaveBeenCalledTimes(2)
    view.unmount()
    expect(pdfjs.destroy).toHaveBeenCalledOnce()
  })
  it('cancels in-flight rendering and releases the worker when closed', async () => {
    let finish!: () => void
    pdfjs.render.mockReturnValueOnce({ promise: new Promise<void>((resolve) => { finish = resolve }), cancel: pdfjs.cancel })
    const view = render(<PdfPreview file={file} />)
    await screen.findByRole('img', { name: 'Página 1 de 2' })
    view.unmount(); finish()
    expect(pdfjs.cancel).toHaveBeenCalledOnce()
    expect(pdfjs.destroy).toHaveBeenCalledOnce()
  })
  it('shows an actionable error when the PDF cannot be rendered', async () => {
    pdfjs.getDocument.mockImplementationOnce(() => { throw new Error('Invalid PDF') })
    render(<PdfPreview file={file} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Você ainda pode baixar o PDF')
  })
})
