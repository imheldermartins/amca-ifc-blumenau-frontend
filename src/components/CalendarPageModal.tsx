import {useEffect, useRef, useState} from 'react'
import {Icon} from '@iconify/react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useNavigate} from '@tanstack/react-router'
import {Button, Select} from 'cubs-components'
import {calendarSelectionValue, type RowData, type CellChange} from 'cubs-database'
import {PagePropertiesForm} from './PagePropertiesForm'
import {type ModalControls} from '@/hooks/useModal'
import {useAuth} from '@/contexts/AuthContext'
import {useLanguage} from '@/contexts/LanguageContext'
import {usePageRealtime} from '@/hooks/usePageRealtime'
import {useSocket} from '@/hooks/useSocket'
import {pageWriteService} from '@/services/PageWriteService'
import {scheduleService} from '@/services/ScheduleService'
import {FALLBACK_VIEW_ID, TITLE_COLUMN_ID, parseHeaderCols, type ApiPage} from '@/lib/databaseParser'
import {reorderByIds} from '@/shared/cubs-database/utils'
import {loadCalendarPage, type CalendarPageRequest} from '@/services/CalendarPageService'
import {createPageNavigationState} from '@/lib/pageNavigation'

export function CalendarPageModalContent({request, controls}: {request: CalendarPageRequest; controls: ModalControls}) {
  const {user} = useAuth()
  const {socket} = useSocket()
  const query = useQuery({queryKey: ['calendar-page-modal', user?.id, request.parentPageId, request.workspaceId, request.rowId, request.dateColumnId, request.viewId],
    queryFn: () => loadCalendarPage(request, user!.id), enabled: Boolean(user), staleTime: 0})
  const refetch = query.refetch
  const parentId = query.data?.parentId
  useEffect(() => {
    if (!socket || !request.rowId) return
    const refresh = (event: {pageId: string}) => {if (event.pageId === parentId) void refetch()}
    socket.on('cell-updated', refresh); socket.on('column-updated', refresh); socket.on('projection-invalidated', refresh)
    socket.on('column-created', refresh); socket.on('column-deleted', refresh); socket.on('page-updated', refresh); socket.on('row-deleted', refresh); socket.on('view-updated', refresh)
    return () => {
      socket.off('cell-updated', refresh); socket.off('column-updated', refresh); socket.off('projection-invalidated', refresh)
      socket.off('column-created', refresh); socket.off('column-deleted', refresh); socket.off('page-updated', refresh); socket.off('row-deleted', refresh); socket.off('view-updated', refresh)
    }
  }, [socket, request.rowId, parentId, refetch])
  if (query.isPending) return <p role="status">Carregando página e propriedades…</p>
  if (query.isError) return <div role="alert">{query.error.message}<Button onClick={() => void query.refetch()}>Tentar novamente</Button></div>
  return <CalendarPageEditor request={request} controls={controls} data={query.data} refresh={() => { void query.refetch() }} />
}

type PageModalData = Awaited<ReturnType<typeof loadCalendarPage>>

export function CalendarPageEditor({request, controls, data, refresh}: {request: CalendarPageRequest; controls: ModalControls; data: PageModalData; refresh: () => void}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const {slug: lang} = useLanguage()
  const [title, setTitle] = useState(data.page?.title ?? '')
  const [columns, setColumns] = useState(data.columns)
  const orderRevision = useRef(0)
  const localOrder = useRef<string[] | null>(null)
  const confirmedOrder = useRef(data.view?.orderedHeaderCols ?? data.columns.map(column => column.id))
  const viewContext = useRef({viewId: data.viewId, view: data.view})
  const [dateColumnId, setDateColumnId] = useState(data.dateColumnId)
  const [row, setRow] = useState<RowData>(() => data.row ?? {id: 'draft', cells: {
    ...Object.fromEntries(Object.entries(request.initialValues ?? {}).map(([id, value]) => [id, {value}])),
    ...(data.dateColumnId && request.selection ? {[data.dateColumnId]: {value: calendarSelectionValue(request.selection)}} : {}),
  }})
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const sorting = useRef(false)
  const writes = useRef(new Map<string, Promise<void>>())
  const confirmedValues = useRef(data.row?.cells ?? {})
  const writeFailed = useRef(false)
  const [saving, setSaving] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [createdPage, setCreatedPage] = useState<ApiPage | null>(null)
  const [pinned, setPinned] = useState(request.calendarActions?.pinned ?? false)
  const [confirmingUnpin, setConfirmingUnpin] = useState(false)
  const [colorColumnId, setColorColumnId] = useState<string | null>(request.calendarActions?.colorColumnId ?? data.columns.find(column => column.type === 'select')?.id ?? null)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const savedTitle = useRef(data.page?.title ?? '')
  useEffect(() => {
    // Keep the latest local gesture through intermediate HTTP/socket refetches.
    // Fresh definitions still add/remove properties; reopening reads the saved view.
    setColumns(localOrder.current ? reorderByIds(data.columns, localOrder.current) : data.columns)
    if (request.rowId && data.row && !writes.current.size) {
      setRow(data.row); confirmedValues.current = data.row.cells
      setTitle(data.page?.title ?? ''); savedTitle.current = data.page?.title ?? ''
    }
  }, [data, request.rowId])
  // The parent database remains subscribed. The child subscription updates title
  // and access without joining/leaving the parent's existing room.
  usePageRealtime(request.rowId, {onPageUpdated: payload => { setTitle(payload.title ?? ''); savedTitle.current = payload.title ?? '' }, onAccessDenied: () => controls.closeModal()})
  const fail = (failure: unknown) => { if (active.current) setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.') }
  const enqueue = (key: string, write: () => Promise<unknown>) => {
    writeFailed.current = false
    setSaving(count => count + 1); setError(null); controls.updateModal({dismissible: false})
    const previous = writes.current.get(key) ?? Promise.resolve()
    const task = previous.then(write).then(() => undefined).catch(failure => {writeFailed.current = true; fail(failure)})
    writes.current.set(key, task)
    void task.finally(() => {
      if (writes.current.get(key) === task) writes.current.delete(key)
      if (!active.current) return
      setSaving(count => count - 1)
      if (!writes.current.size) {controls.updateModal({dismissible: !inFlight.current && !sorting.current}); refresh()}
    })
    return task
  }
  const change = (change: CellChange) => {
    if (data.lockedKeys.has(change.columnId)) return
    setRow(current => ({...current, cells: {...current.cells, [change.columnId]: {value: change.value}}}))
    if (request.rowId) void enqueue(change.columnId, async () => {
      await pageWriteService.saveCell({...change, previousValue: confirmedValues.current[change.columnId]?.value})
      confirmedValues.current = {...confirmedValues.current, [change.columnId]: {value: change.value}}
    })
  }
  const reorderProperties = (ids: string[]) => {
    if (!data.canConfigure || !viewContext.current.view || !viewContext.current.viewId) return
    const orderedHeaderCols = [...new Set(ids)]
    const revision = ++orderRevision.current
    localOrder.current = orderedHeaderCols
    setColumns(current => reorderByIds(current, orderedHeaderCols))
    void enqueue('property-order', async () => {
      try {
        let {viewId, view} = viewContext.current
        if (!viewId || !view) throw new Error('View indisponível para ordenar propriedades.')
        if (viewId === FALLBACK_VIEW_ID) {
          // Retain the real id even if the following PATCH fails, so retrying
          // or another drag never creates a second fallback view.
          const created = await pageWriteService.createView(data.parentId, view.view, view.name, view.title)
          viewContext.current = created
          viewId = created.viewId
        }
        const saved = await pageWriteService.patchView(data.parentId, viewId, {orderedHeaderCols})
        viewContext.current = saved
        confirmedOrder.current = saved.view.orderedHeaderCols
        if (active.current) request.onViewOrderSaved?.(saved.viewId, saved.view)
      } catch (failure) {
        if (revision !== orderRevision.current) return
        localOrder.current = confirmedOrder.current
        if (active.current) setColumns(current => reorderByIds(current, confirmedOrder.current))
        throw failure
      }
    })
  }
  const saveTitle = () => {
    if (!request.rowId || !data.canEdit || data.titleLocked || title === savedTitle.current) return
    savedTitle.current = title
    return enqueue('title', () => pageWriteService.updateTitle(request.rowId!, title || null))
  }
  const finish = async (openPage = false) => {
    if (sorting.current) return
    saveTitle()
    await Promise.all(writes.current.values())
    if (!active.current || writeFailed.current) return
    controls.closeModal()
    if (openPage && request.rowId) void navigate({to: '/$lang/page/$pageId', params: {lang, pageId: request.rowId}, search: {}, state: createPageNavigationState(request.rowId, title)})
  }
  const pin = async (unpin = false, nextColorColumnId = colorColumnId) => {
    const actions = request.calendarActions
    if (!actions || !request.rowId || !dateColumnId || inFlight.current) return
    inFlight.current = true; setPending(true); setError(null)
    try {
      const saved = await (unpin ? actions.onUnpin(request.rowId) : actions.onPin({pageId: request.rowId, dateColumnId, colorColumnId: nextColorColumnId}))
      if (saved !== false && active.current) {setPinned(!unpin); setConfirmingUnpin(false)}
    } catch (failure) {fail(failure)}
    finally {inFlight.current = false; if (active.current) setPending(false)}
  }
  const ensureDate = async () => {
    if (inFlight.current) return
    inFlight.current = true; setPending(true); setError(null); controls.updateModal({dismissible: false})
    try {
      const column = await pageWriteService.ensureScheduleDateColumn(data.parentId)
      if (!active.current) return
      const [header] = parseHeaderCols([column], 'Título').filter(column => column.key !== 'title')
      setColumns(current => [...current.filter(candidate => candidate.id !== column.id), header])
      setDateColumnId(column.id)
      if (request.selection) setRow(current => ({...current, cells: {...current.cells, [column.id]: {value: calendarSelectionValue(request.selection!)}}}))
      request.onDateColumn?.(column.id)
    } catch (failure) { fail(failure) }
    finally { inFlight.current = false; if (active.current) {setPending(false); controls.updateModal({dismissible: true})} }
  }
  const submit = async (formValues: {title: string; cells: RowData['cells']} = {title, cells: row.cells}) => {
    if (inFlight.current || sorting.current) return
    if (request.pinOnCreate && (!dateColumnId || !formValues.cells[dateColumnId]?.value)) {setError('Preencha Agendado para para criar na Agenda.'); return}
    inFlight.current = true; setPending(true); setError(null); controls.updateModal({dismissible: false})
    try {
      await Promise.all(writes.current.values())
      if (writeFailed.current) return
      let page = createdPage
      if (!page) {
        const values = Object.fromEntries(Object.entries(formValues.cells).filter(([,cell]) => cell?.value != null).map(([id,cell]) => [id,cell!.value]))
        page = await pageWriteService.createRow(data.parentId, {title: formValues.title || null, values})
        if (!active.current) return
        setCreatedPage(page)
        request.onCreated?.({id: page.id, cells: {...row.cells, [TITLE_COLUMN_ID]: {value: page.title}}})
      }
      if (request.pinOnCreate && request.workspaceId && dateColumnId) {
        await scheduleService.pin(request.workspaceId, page.id, {dateColumnId})
        await queryClient.invalidateQueries({queryKey: ['schedule']})
      }
      if (active.current) controls.closeModal()
    } catch (failure) {fail(failure)}
    finally {inFlight.current = false; if (active.current) {setPending(false); controls.updateModal({dismissible: true})}}
  }
  const needsDate = Boolean(request.pinOnCreate && !request.rowId && !dateColumnId)
  if (needsDate) return <section>
    <h2 className="text-lg font-semibold">Criar propriedade <em>Agendado para</em> em {request.destinationLabel}</h2>
    <p className="mt-3 text-sm">Essa propriedade de data será usada para agendar as páginas.</p>
    {error && <p role="alert" className="mt-3 text-p-red">{error}</p>}
    {!data.canConfigure && <p role="alert">Você não tem permissão para criar propriedades nesta base.</p>}
    <div className="mt-5 flex justify-end gap-2"><Button onClick={controls.closeModal} disabled={pending}>Cancelar</Button><Button color="purple" disabled={pending || !data.canConfigure} onClick={() => void ensureDate()}>{pending ? 'Criando…' : 'Criar propriedade'}</Button></div>
  </section>
  const readOnly = request.rowId ? !data.canEdit : !data.canCreate
  return <PagePropertiesForm destinationLabel={request.destinationLabel} title={title} onTitleChange={setTitle} onTitleBlur={saveTitle}
    titleReadOnly={readOnly || pending || Boolean(createdPage) || data.titleLocked}
    columns={columns} row={row} lockedKeys={data.lockedKeys} onChange={readOnly || createdPage ? undefined : change}
    onOrderChange={data.canConfigure && data.view && data.viewId && !createdPage ? reorderProperties : undefined}
    onSortingChange={active => {sorting.current = active; controls.updateModal({dismissible: !active && !writes.current.size && !inFlight.current})}} disabled={pending || Boolean(createdPage)}
    onSubmit={values => request.rowId ? finish() : submit(values)}>
    {error && <p role="alert" className="text-sm text-p-red">{createdPage ? 'A página foi criada, mas não foi possível fixá-la. Tente fixar novamente. ' : ''}{error}</p>}
    {readOnly && <p className="text-sm">Você não tem permissão para {request.rowId ? 'editar' : 'criar'} esta página.</p>}
    {request.calendarActions && <div className="space-y-3 border-t border-divider pt-3">
      {columns.some(column => column.type === 'select') && <Select label="Cor pela propriedade" value={colorColumnId ?? ''} options={columns.filter(column => column.type === 'select').map(column => ({value: column.id, label: column.title}))} onValueChange={next => {setColorColumnId(next); if (pinned) void pin(false, next)}} disabled={pending} />}
      {confirmingUnpin ? <><p className="text-sm">Desafixar do calendário?</p><Button onClick={() => setConfirmingUnpin(false)} disabled={pending}>Cancelar</Button><Button onClick={() => void pin(true)} disabled={pending}>Desafixar</Button></> : <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => {if (pinned) setConfirmingUnpin(true); else void pin()}}>{pinned ? 'Desafixar da agenda' : 'Fixar na agenda'}</Button>
        {request.calendarActions.onRequestPin && request.rowId && dateColumnId && <Button onClick={() => request.calendarActions!.onRequestPin!({pageId: request.rowId!, dateColumnId, colorColumnId})}>Solicitar fixação</Button>}
      </div>}
    </div>}
    <div className="flex justify-end gap-2">
      {request.rowId ? <Button type="button" onClick={() => void finish(true)}>Abrir página</Button> : <Button type="button" variant="text" disabled={pending} onClick={controls.closeModal}>Cancelar</Button>}
      {request.rowId ? <Button type="submit" color="purple" className="px-5 py-2 text-base" disabled={pending}>{saving ? 'Salvando…' : 'Concluir'}</Button> : <Button type="submit" color="purple" className="px-5 py-2 text-base" disabled={pending || readOnly}>{pending ? 'Salvando…' : createdPage ? 'Tentar fixar novamente' : <>Criar <Icon icon="lucide:chevron-right" className="size-4" aria-hidden="true" /></>}</Button>}
    </div>
  </PagePropertiesForm>
}
