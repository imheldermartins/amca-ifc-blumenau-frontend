import {useState} from 'react'
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, describe, expect, it, vi} from 'vitest'
import {PagePropertyFields} from './PagePropertyFields'
import {mockPropertyRects, dragProperty} from '@/test-utils/propertySortable'
import {reorderByIds} from '../utils'
import type {HeaderCol} from '../types'

const columns: HeaderCol[] = [
  {id: 'page_title', key: 'title', title: 'Título', type: 'text'},
  {id: 'date', title: 'Agendado para', type: 'date'},
  {id: 'notes', title: 'Descrição', type: 'text'},
  {id: 'done', title: 'Concluído', type: 'checkbox'},
  {id: 'amount', title: 'Valor', type: 'numeric'},
]

const ids = () => [...document.querySelectorAll('[data-page-property-id]')].map(row => row.getAttribute('data-page-property-id'))
afterEach(() => {cleanup(); vi.restoreAllMocks()})

describe('sortable modal properties', () => {
  it('registers the whole row as its dropzone and remains correct through twelve drags', async () => {
    mockPropertyRects()
    const changed = vi.fn()
    function Harness() {
      const [current, setColumns] = useState(columns)
      return <PagePropertyFields columns={current} row={{id: 'draft', cells: {notes: {value: 'Conteúdo mantido'}, done: {value: true}}}}
        onChange={vi.fn()} onOrderChange={order => {changed(order); setColumns(previous => reorderByIds(previous, order))}} />
    }
    render(<Harness />)
    expect(document.querySelectorAll('[data-property-dropzone=true]')).toHaveLength(4)
    expect(screen.queryByRole('button', {name: 'Arrastar propriedade Título'})).toBeNull()
    for (let turn = 0; turn < 6; turn++) {
      await dragProperty('Agendado para', 'ArrowDown', 3)
      expect(ids()).toEqual(['notes', 'done', 'amount', 'date'])
      await dragProperty('Agendado para', 'ArrowUp', 3)
      expect(ids()).toEqual(['date', 'notes', 'done', 'amount'])
    }
    expect(changed).toHaveBeenCalledTimes(12)
    expect(changed).toHaveBeenLastCalledWith(['page_title', 'date', 'notes', 'done', 'amount'])
    expect(screen.getByRole('textbox', {name: 'Descrição'})).toHaveProperty('value', 'Conteúdo mantido')
    expect(screen.getByRole('checkbox', {name: 'Concluído'}).getAttribute('aria-checked')).toBe('true')
  }, 15000)

  it('does not reorder by editing a value or by cancelling a drag with Escape', async () => {
    mockPropertyRects()
    const changed = vi.fn(), edit = vi.fn()
    render(<PagePropertyFields columns={columns} row={{id: 'draft', cells: {}}} onChange={edit} onOrderChange={changed} />)
    const field = screen.getByRole('textbox', {name: 'Descrição'})
    fireEvent.focus(field); fireEvent.change(field, {target: {value: 'Notas'}}); fireEvent.blur(field)
    expect(edit).toHaveBeenCalledOnce()
    expect(changed).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('button', {name: 'Arrastar propriedade Descrição'}), {key: ' ', code: 'Space'})
    await waitFor(() => expect(document.querySelector('[data-dragging=true]')).toBeTruthy())
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 0))})
    fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'})
    await waitFor(() => expect(document.querySelector('[data-dragging=true]')).toBeNull())
    expect(ids()).toEqual(['date', 'notes', 'done', 'amount'])
    expect(changed).not.toHaveBeenCalled()
  })
  it('shows padding without drag controls when the caller cannot configure the view', () => {
    render(<PagePropertyFields columns={columns} row={{id: 'draft', cells: {}}} />)
    expect(screen.queryAllByRole('button', {name: /^Arrastar propriedade/})).toHaveLength(0)
    expect(document.querySelector('[data-page-property-id]')?.className).toContain('p-1.5')
  })
  it.each([{x: 300, y: 205, expected: ['page_title', 'notes', 'done', 'amount', 'date']}, {x: 900, y: 205, expected: null}])('uses the final pointer release as the row dropzone, including outside cancellation ($x)', async ({x, y, expected}) => {
    mockPropertyRects()
    const changed = vi.fn()
    render(<PagePropertyFields columns={columns} row={{id: 'draft', cells: {}}} onOrderChange={changed} />)
    const handle = screen.getByRole('button', {name: 'Arrastar propriedade Agendado para'})
    // jsdom has no PointerEvent constructor; preserve coordinates and the
    // primary-pointer fields required by the real PointerSensor.
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, {bubbles: true, cancelable: true, button: 0, buttons: 1, clientX, clientY})
      Object.defineProperties(event, {isPrimary: {value: true}, pointerId: {value: 1}})
      return event
    }
    fireEvent(handle, pointer('pointerdown', 10, 10))
    fireEvent(document, pointer('pointermove', 10, 25))
    await waitFor(() => expect(document.querySelector('[data-dragging=true]')).toBeTruthy())
    // Hover is still on the second row when the final release lands on the fourth.
    fireEvent(document, pointer('pointermove', 20, 90))
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 0))})
    fireEvent(document, pointer('pointerup', x, y))
    await waitFor(() => expect(document.querySelector('[data-dragging=true]')).toBeNull())
    if (expected) expect(changed).toHaveBeenCalledExactlyOnceWith(expected)
    else expect(changed).not.toHaveBeenCalled()
  })
})
