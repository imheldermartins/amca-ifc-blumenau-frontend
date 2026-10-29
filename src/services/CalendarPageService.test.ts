import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {loadCalendarPage} from './CalendarPageService'
import {databaseService} from './DatabaseService'
import {accessService} from './AccessService'
import {columnLockService} from './ColumnLockService'
import {pageWriteService} from './PageWriteService'
import {FALLBACK_VIEW_ID, type ApiPage, type ApiPageColumn} from '@/lib/databaseParser'
import {emptyViewFilters, type DataViewType} from 'cubs-database'

const page: ApiPage = {id: 'membership-root', title: 'Raiz do membro', owner_id: 'user', data: null, created_at: '', updated_at: ''}
const date: ApiPageColumn = {id: 'scheduled', name: 'Agendado para', type: 'date', parent_id: page.id, data: {publicKey: {key: 'agendado_para', aliases: []}}}
beforeEach(() => {
  vi.spyOn(databaseService, 'getEntryPage').mockResolvedValue(page)
  vi.spyOn(databaseService, 'getPage').mockResolvedValue({...page, id: 'child'})
  vi.spyOn(databaseService, 'getColumns').mockResolvedValue([date])
  vi.spyOn(accessService, 'current').mockResolvedValue({permissions: {read: ['view'], write: ['create', 'update', 'edit_subpages']}} as never)
  vi.spyOn(columnLockService, 'get').mockResolvedValue({locks: {}, editors: [], canManage: false})
  vi.spyOn(columnLockService, 'titleStatus').mockResolvedValue({locked: false, canEdit: true})
  vi.spyOn(pageWriteService, 'ensureScheduleDateColumn').mockResolvedValue(date)
})
afterEach(() => vi.restoreAllMocks())
describe('calendar page destination and hydration', () => {
  it.each(['graph', 'timeline'] as const)('uses the %s property order without requiring a date or selecting the Calendar view', async viewType => {
    const view: DataViewType = {view: viewType, name: viewType, urlKey: {key: viewType, aliases: []}, filters: emptyViewFilters(), orderedHeaderCols: ['description', 'page_title']}
    vi.mocked(databaseService.getPage).mockResolvedValue({...page, data: {calendar: {...view, view: 'calendar', orderedHeaderCols: ['page_title', 'description']}, selected: view}})
    vi.mocked(databaseService.getColumns).mockResolvedValue([{id: 'description', name: 'Descrição', type: 'text', parent_id: page.id, data: null}])
    const data = await loadCalendarPage({parentPageId: page.id, viewType, destinationLabel: 'Base'}, 'user')
    expect(data.viewId).toBe('selected')
    expect(data.columns.map(column => column.id)).toEqual(['description', 'page_title'])
    expect(data.dateColumnId).toBeUndefined()
    expect(pageWriteService.ensureScheduleDateColumn).not.toHaveBeenCalled()
  })
  it('resolves the authenticated member root and requires the scheduled key in Agenda', async () => {
    vi.mocked(databaseService.getColumns).mockResolvedValue([{...date, id: 'other-date', data: {publicKey: {key: 'outra_data', aliases: []}}}])
    const data = await loadCalendarPage({workspaceId: 'workspace', pinOnCreate: true, destinationLabel: 'Workspace'}, 'user')
    expect(databaseService.getEntryPage).toHaveBeenCalledWith('workspace')
    expect(databaseService.getColumns).toHaveBeenCalledWith('membership-root')
    expect(data.parentId).toBe('membership-root')
    expect(data.dateColumnId).toBeUndefined()
  })
  it('preserves the opened database as parent even when a workspace exists', async () => {
    const data = await loadCalendarPage({parentPageId: 'opened-base', workspaceId: 'workspace', dateColumnId: date.id, destinationLabel: 'Base'}, 'user')
    expect(databaseService.getEntryPage).not.toHaveBeenCalled()
    expect(data.parentId).toBe('opened-base')
    expect(data.dateColumnId).toBe('scheduled')
  })
  it('hydrates just the requested child, including values outside retained calendar pages', async () => {
    vi.spyOn(databaseService, 'queryView').mockResolvedValue({version: 1, kind: 'table', pageId: page.id, viewId: FALLBACK_VIEW_ID, queryKey: 'q', orderRevision: 0, total: 10000, windows: [], includedRows: [{page_id: 'child', page_title: 'Evento', page_columns: {scheduled: {row_id: 'cell', row_data: JSON.stringify({value: '2026-10-27T09:30:00.000Z'}), column_name: 'Agendado para', column_type: 'date', column_data: null}}}]})
    vi.mocked(columnLockService.get).mockResolvedValue({locks: {scheduled: {userIds: ['other']}}, editors: [], canManage: false})
    const data = await loadCalendarPage({parentPageId: page.id, rowId: 'child', destinationLabel: 'Base'}, 'user')
    expect(databaseService.queryView).toHaveBeenCalledExactlyOnceWith(page.id, FALLBACK_VIEW_ID, {view: 'table', metadataOnly: true, includeRowIds: ['child']})
    expect(data.row?.cells.scheduled?.value).toBe('2026-10-27T09:30:00.000Z')
    expect(data.lockedKeys.has('scheduled')).toBe(true)
  })
  it('refuses an incompatible scheduled property without silently selecting another date', async () => {
    vi.mocked(databaseService.getColumns).mockResolvedValue([{...date, type: 'text'}, {...date, id: 'other-date', data: {}}])
    await expect(loadCalendarPage({workspaceId: 'workspace', pinOnCreate: true, destinationLabel: 'Workspace'}, 'user')).rejects.toThrow('outro tipo')
  })
  it('keeps the Agenda binding by id after the property name and public key change', async () => {
    vi.mocked(databaseService.getPage).mockResolvedValue({...page, data: {schedule: {dateColumnId: 'scheduled'}}})
    vi.mocked(databaseService.getColumns).mockResolvedValue([{...date, name: 'Entrega combinada', data: {publicKey: {key: 'entrega_combinada', aliases: []}}}])
    const data = await loadCalendarPage({workspaceId: 'workspace', pinOnCreate: true, destinationLabel: 'Workspace'}, 'user')
    expect(data.dateColumnId).toBe('scheduled')
    expect(pageWriteService.ensureScheduleDateColumn).not.toHaveBeenCalled()
  })
  it('uses the database view date independently from the Agenda binding and reads its saved column order', async () => {
    const view: DataViewType = {view: 'calendar', name: 'Calendário', urlKey: {key: 'calendar', aliases: []}, filters: emptyViewFilters(), dateColumnId: 'other-date', orderedHeaderCols: ['page_title', 'other-date', 'scheduled']}
    vi.mocked(databaseService.getPage).mockResolvedValue({...page, data: {schedule: {dateColumnId: 'scheduled'}, selected: view, unrelated: {...view, name: 'Outra', dateColumnId: 'scheduled', orderedHeaderCols: ['page_title', 'scheduled', 'other-date']}}})
    vi.mocked(databaseService.getColumns).mockResolvedValue([date, {...date, id: 'other-date', name: 'Prazo', data: {}}])
    const data = await loadCalendarPage({parentPageId: page.id, viewId: 'selected', dateColumnId: 'other-date', destinationLabel: 'Base'}, 'user')
    expect(data.dateColumnId).toBe('other-date')
    expect(data.viewId).toBe('selected')
    expect(data.columns.map(column => column.id)).toEqual(['page_title', 'other-date', 'scheduled'])
    expect(pageWriteService.ensureScheduleDateColumn).not.toHaveBeenCalled()
  })
  it('never switches a deleted tracked Agenda property to another available date', async () => {
    vi.mocked(databaseService.getPage).mockResolvedValue({...page, data: {schedule: {dateColumnId: 'deleted'}}})
    await expect(loadCalendarPage({workspaceId: 'workspace', pinOnCreate: true, destinationLabel: 'Workspace'}, 'user')).rejects.toThrow('vínculo não foi substituído')
    expect(pageWriteService.ensureScheduleDateColumn).not.toHaveBeenCalled()
  })
})
