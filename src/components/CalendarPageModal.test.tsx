import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import type {ComponentProps} from 'react'
import {CalendarPageEditor} from './CalendarPageModal'
import {scheduledDateColumn, type CalendarPageRequest} from '@/services/CalendarPageService'
import {Modal} from './Modal'
import {pageWriteService} from '@/services/PageWriteService'
import {scheduleService} from '@/services/ScheduleService'
import {apiService} from '@/services/ApiService'
import {emptyViewFilters} from 'cubs-database'
import {reorderByIds} from '@/shared/cubs-database/utils'
import {FALLBACK_VIEW_ID} from '@/lib/databaseParser'
import {mockPropertyRects, dragProperty} from '@/test-utils/propertySortable'
import {ModalProvider} from '@/contexts/ModalContext'
import {useModal} from '@/hooks/useModal'

vi.mock('@tanstack/react-router', () => ({useNavigate: () => vi.fn()}))
vi.mock('@/contexts/LanguageContext', () => ({useLanguage: () => ({slug: 'pt-br'})}))
vi.mock('@/hooks/usePageRealtime', () => ({usePageRealtime: () => ({joined: true})}))

const page = {id: 'created', title: 'Reunião', data: null, owner_id: 'user', created_at: '', updated_at: ''}
const model = (): ComponentProps<typeof CalendarPageEditor>['data'] => ({parentId: 'parent', columns: [
  {id: 'title', key: 'title', title: 'Título', type: 'text'},
  {id: 'date', title: 'Agendado para', type: 'date'},
  {id: 'description', title: 'Descrição', type: 'text'},
  {id: 'status', title: 'Status', type: 'select', options: [{id: 'doing', label: 'Em andamento', color: 'blue'}]},
  {id: 'done', title: 'Concluído', type: 'checkbox'},
], viewId: 'calendar-view', view: {view: 'calendar', name: 'Calendário', urlKey: {key: 'calendario', aliases: []}, filters: emptyViewFilters(), orderedHeaderCols: ['title', 'date', 'description', 'status', 'done']}, dateColumnId: 'date', row: undefined, page: null, lockedKeys: new Set(), canCreate: true, canConfigure: true, canEdit: false, titleLocked: false})
const controls = () => ({closeModal: vi.fn(), updateModal: vi.fn(), setModalContent: vi.fn()})
function fixture(request: Partial<CalendarPageRequest> = {}, data = model(), inModal = false) {
  const modalControls = controls()
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  const content = (next: typeof data) => {
    const body = <CalendarPageEditor request={{parentPageId: 'parent', destinationLabel: 'Minha base', selection: {day: '2026-10-27', allDay: true}, ...request}} controls={modalControls} data={next} refresh={vi.fn()} />
    return <QueryClientProvider client={client}>{inModal ? <Modal open onOpenChange={vi.fn()}>{body}</Modal> : body}</QueryClientProvider>
  }
  const mounted = render(content(data))
  return {...modalControls, unmount: mounted.unmount, rerenderData: (next: typeof data) => mounted.rerender(content(next))}
}
beforeEach(() => {
  vi.spyOn(pageWriteService, 'createRow').mockResolvedValue(page)
  vi.spyOn(pageWriteService, 'saveCell').mockResolvedValue({})
  vi.spyOn(scheduleService, 'pin').mockResolvedValue({} as never)
})
afterEach(() => {cleanup(); vi.restoreAllMocks()})

describe('calendar page modal', () => {
  it('keeps the click context as a draft and submits title and property values only once', async () => {
    const onCreated = vi.fn()
    const modal = fixture({onCreated})
    expect(pageWriteService.createRow).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole('textbox', {name: /título da página/i}), {target: {value: 'Reunião'}})
    const description = screen.getByRole('textbox', {name: 'Descrição'})
    fireEvent.focus(description); fireEvent.change(description, {target: {value: 'Notas'}}); fireEvent.blur(description)
    fireEvent.click(screen.getByRole('checkbox', {name: 'Concluído'}))
    fireEvent.click(screen.getByRole('button', {name: 'Criar'}))
    await waitFor(() => expect(modal.closeModal).toHaveBeenCalledOnce())
    expect(pageWriteService.createRow).toHaveBeenCalledExactlyOnceWith('parent', {title: 'Reunião', values: {date: '2026-10-27T00:00:00.000Z', description: 'Notas', done: true}})
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({id: 'created', cells: expect.objectContaining({page_title: {value: 'Reunião'}, date: {value: '2026-10-27T00:00:00.000Z'}})}))
  })
  it('cancels without creating and opens the header + with blank values', () => {
    const modal = fixture({selection: undefined})
    expect(screen.getByRole('button', {name: 'Agendado para'}).textContent).not.toContain('27/10')
    fireEvent.click(screen.getByRole('button', {name: 'Cancelar'}))
    expect(modal.closeModal).toHaveBeenCalledOnce()
    expect(pageWriteService.createRow).not.toHaveBeenCalled()
  })
  it('never offers Agenda property creation in a database modal without a date column', () => {
    const ensure = vi.spyOn(pageWriteService, 'ensureScheduleDateColumn')
    const data = model(); data.dateColumnId = undefined; data.columns = data.columns.filter(column => column.type !== 'date')
    fixture({}, data)
    expect(screen.queryByRole('button', {name: 'Criar propriedade'})).toBeNull()
    expect(screen.getByRole('button', {name: 'Criar'})).toBeTruthy()
    expect(ensure).not.toHaveBeenCalled()
  })
  it('keeps the original selection after confirming creation of the scheduling property', async () => {
    vi.spyOn(apiService, 'post').mockResolvedValue({id: 'new-date', name: 'Agendado para', type: 'date', parent_id: 'parent', data: {}})
    const data = model(); data.dateColumnId = undefined; data.columns = []
    fixture({pinOnCreate: true, workspaceId: 'workspace', selection: {day: '2026-10-27', allDay: false, minute: 570}}, data)
    expect(screen.getByRole('heading').textContent).toContain('Agendado para')
    fireEvent.click(screen.getByRole('button', {name: 'Criar propriedade'}))
    await screen.findByRole('button', {name: 'Criar'})
    fireEvent.click(screen.getByRole('button', {name: 'Criar'}))
    await waitFor(() => expect(pageWriteService.createRow).toHaveBeenCalledWith('parent', {title: null, values: {'new-date': '2026-10-27T09:30:00.000Z@2026-10-27T10:00:00.000Z'}}))
  })
  it('retries the Agenda pin without creating a second page', async () => {
    vi.mocked(scheduleService.pin).mockRejectedValueOnce(new Error('Offline'))
    const modal = fixture({pinOnCreate: true, workspaceId: 'workspace'})
    fireEvent.click(screen.getByRole('button', {name: 'Criar'}))
    await screen.findByRole('button', {name: 'Tentar fixar novamente'})
    expect(modal.closeModal).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: 'Tentar fixar novamente'}))
    await waitFor(() => expect(modal.closeModal).toHaveBeenCalledOnce())
    expect(pageWriteService.createRow).toHaveBeenCalledOnce()
    expect(scheduleService.pin).toHaveBeenCalledTimes(2)
  })
  it('keeps date and select portals interactive above the modal and Escape closes the editor first', async () => {
    fixture({}, model(), true)
    const modal = screen.getByRole('dialog')
    fireEvent.click(screen.getByRole('button', {name: 'Agendado para'}))
    const dateEditor = await screen.findByRole('button', {name: 'Aplicar'})
    expect(dateEditor.closest('[data-radix-popper-content-wrapper]')).toBeTruthy()
    expect(dateEditor.closest('[data-state=open]')?.className).toContain('z-[90]')
    fireEvent.keyDown(dateEditor, {key: 'Escape'})
    await waitFor(() => expect(screen.queryByRole('button', {name: 'Aplicar'})).toBeNull())
    expect(screen.getByRole('dialog')).toBe(modal)
    fireEvent.click(screen.getByRole('button', {name: 'Status'}))
    fireEvent.click(await screen.findByRole('button', {name: 'Em andamento'}))
    expect(screen.getByRole('dialog')).toBe(modal)
    expect(pageWriteService.createRow).not.toHaveBeenCalled()
  })
  it('honors locks and uses existing cell writes for a persisted page', async () => {
    const data = model(); data.row = {id: 'existing', cells: {done: {value: false}}}; data.page = {...page, id: 'existing'}; data.canEdit = true; data.lockedKeys.add('description')
    fixture({rowId: 'existing'}, data)
    expect(screen.queryByRole('textbox', {name: 'Descrição'})).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', {name: 'Concluído'}))
    await waitFor(() => expect(pageWriteService.saveCell).toHaveBeenCalledWith({rowId: 'existing', columnId: 'done', previousValue: false, value: true}))
    expect(pageWriteService.createRow).not.toHaveBeenCalled()
  })
  it('serializes repeated edits to a newly populated cell and waits before closing', async () => {
    let finishFirst!: () => void
    vi.mocked(pageWriteService.saveCell).mockImplementationOnce(() => new Promise(resolve => {finishFirst = () => resolve({})}))
    const data = model(); data.row = {id: 'existing', cells: {}}; data.page = {...page, id: 'existing'}; data.canEdit = true
    const modal = fixture({rowId: 'existing'}, data)
    fireEvent.click(screen.getByRole('checkbox', {name: 'Concluído'}))
    fireEvent.click(screen.getByRole('checkbox', {name: 'Concluído'}))
    await waitFor(() => expect(pageWriteService.saveCell).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByRole('button', {name: 'Salvando…'}))
    expect(modal.closeModal).not.toHaveBeenCalled()
    finishFirst()
    await waitFor(() => expect(modal.closeModal).toHaveBeenCalledOnce())
    expect(vi.mocked(pageWriteService.saveCell).mock.calls.map(call => call[0])).toEqual([
      {rowId: 'existing', columnId: 'done', previousValue: undefined, value: true},
      {rowId: 'existing', columnId: 'done', previousValue: true, value: false},
    ])
  })
  it('finds Agendado para by its stable key or alias, not by an unrelated date', () => {
    expect(scheduledDateColumn([{id: 'other', name: 'Outra data', type: 'date', parent_id: 'parent', data: {publicKey: {key: 'other', aliases: []}}}])).toBeUndefined()
    expect(scheduledDateColumn([{id: 'found', name: 'Renomeada', type: 'date', parent_id: 'parent', data: {publicKey: {key: 'renomeada', aliases: ['agendado_para']}}}])?.id).toBe('found')
  })
  it('serializes multiple sorts, ignores stale refresh order and restores the persisted view on reopen', async () => {
    mockPropertyRects()
    const data = model()
    let stored = structuredClone(data.view!)
    let release!: () => void
    const first = new Promise<void>(resolve => {release = resolve})
    let count = 0
    const patch = vi.spyOn(pageWriteService, 'patchView').mockImplementation(async (_page, viewId, changes) => {
      if (++count === 1) await first
      stored = {...stored, ...changes}
      return {viewId, view: structuredClone(stored)}
    })
    const onViewOrderSaved = vi.fn()
    const modal = fixture({onViewOrderSaved}, data)
    await dragProperty('Agendado para', 'ArrowDown', 3)
    await dragProperty('Descrição', 'ArrowDown', 2)
    await dragProperty('Agendado para', 'ArrowUp', 3)
    const expected = ['date', 'status', 'done', 'description']
    const visible = () => [...document.querySelectorAll('[data-page-property-id]')].map(element => element.getAttribute('data-page-property-id'))
    expect(visible()).toEqual(expected)
    expect(patch).toHaveBeenCalledTimes(1)
    modal.rerenderData({...data, columns: [...data.columns], view: {...data.view!, orderedHeaderCols: ['title', 'description', 'status', 'done', 'date']}})
    expect(visible()).toEqual(expected)
    await act(async () => {release(); await first})
    await waitFor(() => expect(onViewOrderSaved).toHaveBeenCalledTimes(3))
    expect(patch.mock.calls.map(call => call[0])).toEqual(['parent', 'parent', 'parent'])
    expect(patch.mock.calls.every(call => call[1] === 'calendar-view' && Object.keys(call[2]).join() === 'orderedHeaderCols')).toBe(true)
    expect(stored.orderedHeaderCols).toEqual(['title', ...expected])
    expect(pageWriteService.createRow).not.toHaveBeenCalled()
    modal.unmount()
    fixture({}, {...data, columns: reorderByIds(data.columns, stored.orderedHeaderCols), view: stored})
    expect(visible()).toEqual(expected)
    await dragProperty('Descrição', 'ArrowUp', 3)
    await waitFor(() => expect(stored.orderedHeaderCols).toEqual(['title', 'description', 'date', 'status', 'done']))
  }, 15000)

  it('retains a materialized fallback id after failure and recovers without duplicating views', async () => {
    mockPropertyRects()
    const data = model(); data.viewId = FALLBACK_VIEW_ID; data.view = {...data.view!, view: 'table', name: 'Tabela'}
    const created = {viewId: 'materialized', view: data.view}
    const create = vi.spyOn(pageWriteService, 'createView').mockResolvedValue(created)
    const patch = vi.spyOn(pageWriteService, 'patchView').mockRejectedValueOnce(new Error('Falha de rede'))
      .mockImplementation(async (_page, viewId, changes) => ({viewId, view: {...data.view!, ...changes}}))
    const onViewOrderSaved = vi.fn()
    fixture({onViewOrderSaved}, data)
    await dragProperty('Agendado para', 'ArrowDown')
    await screen.findByRole('alert')
    expect([...document.querySelectorAll('[data-page-property-id]')].map(element => element.getAttribute('data-page-property-id'))).toEqual(['date', 'description', 'status', 'done'])
    await dragProperty('Descrição', 'ArrowDown')
    await waitFor(() => expect(onViewOrderSaved).toHaveBeenCalledOnce())
    expect(create).toHaveBeenCalledOnce()
    expect(patch.mock.calls.map(call => call[1])).toEqual(['materialized', 'materialized'])
    expect(screen.queryByRole('alert')).toBeNull()
  })
  it('cancels sorting with Escape without closing the modal, then allows a normal close', async () => {
    mockPropertyRects()
    const patch = vi.spyOn(pageWriteService, 'patchView')
    const data = model()
    function Harness() {
      const {openModal} = useModal()
      return <button onClick={() => openModal({content: controls => <CalendarPageEditor request={{parentPageId: 'parent', destinationLabel: 'Base'}} controls={controls} data={data} refresh={vi.fn()} />})}>Abrir modal</button>
    }
    render(<QueryClientProvider client={new QueryClient()}><ModalProvider><Harness /></ModalProvider></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', {name: 'Abrir modal'}))
    fireEvent.keyDown(screen.getByRole('button', {name: 'Arrastar propriedade Descrição'}), {key: ' ', code: 'Space'})
    await waitFor(() => expect(document.querySelector('[data-dragging=true]')).toBeTruthy())
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 0))})
    fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'})
    await waitFor(() => expect(document.querySelector('[data-dragging=true]')).toBeNull())
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(patch).not.toHaveBeenCalled()
    fireEvent.keyDown(document, {key: 'Escape', code: 'Escape'})
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
