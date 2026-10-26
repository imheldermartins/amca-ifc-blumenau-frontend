import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TextCellEditor } from './TextCellEditor'

afterEach(cleanup)
describe('multiline card editing', () => {
  it('blurs and discards a stale textarea draft when realtime replaces its value', () => {
    const onCommit = vi.fn(), onExternalConflict = vi.fn()
    const props = { column: { id: 'title', key: 'title' as const, title: 'Título', type: 'text' as const }, rowId: 'row', onCommit, onExternalConflict, multiline: true }
    const view = render(<TextCellEditor {...props} value="Original" />)
    const field = screen.getByLabelText('Título') as HTMLTextAreaElement
    expect(field.tagName).toBe('TEXTAREA')
    field.focus()
    fireEvent.change(field, { target: { value: 'Rascunho\nsegunda linha' } })
    view.rerender(<TextCellEditor {...props} value="Valor recebido" />)
    expect(field.value).toBe('Valor recebido')
    expect(document.activeElement).not.toBe(field)
    expect(onExternalConflict).toHaveBeenCalledOnce()
    expect(onCommit).not.toHaveBeenCalled()
  })
})
