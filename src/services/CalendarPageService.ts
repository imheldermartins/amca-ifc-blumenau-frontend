import type {CalendarCreateSelection} from 'cubs-components'
import type {CalendarPinInput, RowData, DataViewType, DataViewKind} from 'cubs-database'
import {reorderByIds} from '@/shared/cubs-database/utils'
import {databaseService} from './DatabaseService'
import {accessService, can} from './AccessService'
import {columnLockService} from './ColumnLockService'
import {pageWriteService} from './PageWriteService'
import {FALLBACK_VIEW_ID, createFallbackViewSettings, parseViewSettings, parseHeaderCols, parseRows, type ApiPageColumn} from '@/lib/databaseParser'

export interface CalendarPageRequest {
  parentPageId?: string
  workspaceId?: string
  destinationLabel: string
  dateColumnId?: string
  viewId?: string
  viewType?: DataViewKind
  selection?: CalendarCreateSelection
  initialValues?: Record<string, unknown>
  rowId?: string
  /** Only Agenda creates a personal pin; database creation remains local to its base. */
  pinOnCreate?: boolean
  onCreated?: (row: RowData) => void
  onDateColumn?: (columnId: string) => void
  onViewOrderSaved?: (viewId: string, view: DataViewType) => void
  calendarActions?: {
    pinned: boolean
    colorColumnId?: string | null
    onPin: (input: CalendarPinInput) => void | boolean | Promise<boolean>
    onUnpin: (pageId: string) => void | boolean | Promise<boolean>
    onRequestPin?: (input: CalendarPinInput) => void
  }
}

export function scheduledDateColumn(columns: ApiPageColumn[]): ApiPageColumn | undefined {
  return columns.find(column => column.data?.publicKey?.key === 'agendado_para' || column.data?.publicKey?.aliases?.includes('agendado_para')
    || (!column.data?.publicKey && column.name?.trim().toLocaleLowerCase() === 'agendado para'))
}

export async function loadCalendarPage(request: CalendarPageRequest, userId: string) {
  const parentId = request.parentPageId ?? (request.workspaceId ? (await databaseService.getEntryPage(request.workspaceId)).id : undefined)
  if (!parentId) throw new Error('Selecione um espaço de trabalho para criar uma página.')
  const [columns, permission, lockConfig, page, parentPage] = await Promise.all([
    databaseService.getColumns(parentId), accessService.current('page', parentId), columnLockService.get(parentId),
    request.rowId ? databaseService.getPage(request.rowId) : Promise.resolve(null),
    databaseService.getPage(parentId),
  ])
  const titleLock = request.rowId ? await columnLockService.titleStatus(request.rowId) : null
  const rowPermission = request.rowId ? await accessService.current('page', request.rowId) : null
  const projection = request.rowId ? await databaseService.queryView(parentId, FALLBACK_VIEW_ID, {view: 'table', metadataOnly: true, includeRowIds: [request.rowId]}) : null
  const row = projection ? parseRows(projection.includedRows ?? []).find(row => row.id === request.rowId) : undefined
  if (request.rowId && !row) throw new Error('A página não está disponível nesta base.')
  let effectiveColumns = columns
  let dateColumn: ApiPageColumn | undefined
  if (request.pinOnCreate) {
    const schedule = parentPage.data?.schedule
    const trackedId = schedule && typeof schedule === 'object' && !Array.isArray(schedule)
      ? (schedule as Record<string, unknown>).dateColumnId : undefined
    if (trackedId != null) {
      dateColumn = columns.find(column => column.id === trackedId)
      if (dateColumn?.type !== 'date') throw new Error('A propriedade vinculada à Agenda foi removida ou deixou de ser uma data. O vínculo não foi substituído.')
    } else {
      dateColumn = scheduledDateColumn(columns)
      if (dateColumn && dateColumn.type !== 'date') throw new Error('A chave Agendado para pertence a uma propriedade de outro tipo.')
      if (dateColumn) {
        dateColumn = await pageWriteService.ensureScheduleDateColumn(parentId)
        effectiveColumns = [...columns.filter(column => column.id !== dateColumn!.id), dateColumn]
      }
    }
  } else {
    dateColumn = request.dateColumnId ? columns.find(column => column.type === 'date' && column.id === request.dateColumnId) : columns.find(column => column.type === 'date')
  }
  const headers = parseHeaderCols(effectiveColumns, 'Título').map(column => ({...column,
    ...(column.type === 'relation' && column.relation ? {loadRelationOptions: (input: {search?: string; cursor?: string; limit?: number}) => databaseService.listRelationOptions(column.relation!.targetDatabaseId, input), relationTargets: projection?.relationTargets} : {}),
  }))
  const lockedKeys = new Set(Object.entries(lockConfig.locks).filter(([, lock]) => !lock.userIds.includes(userId)).map(([key]) => key))
  const savedViews = parseViewSettings(parentPage.data, 'Título')
  const views = Object.keys(savedViews).length ? savedViews : createFallbackViewSettings(headers, 'Tabela')
  const entries = Object.entries(views)
  const selected = request.viewId && request.viewId !== FALLBACK_VIEW_ID
    ? entries.find(([id]) => id === request.viewId)
    : entries.find(([, view]) => view.view === (request.viewType ?? 'calendar') && view.dateColumnId === dateColumn?.id)
      ?? entries.find(([, view]) => view.view === (request.viewType ?? 'calendar')) ?? entries[0]
  const [viewId, view] = selected ?? []
  return {parentId, columns: reorderByIds(headers, view?.orderedHeaderCols ?? []), viewId, view, dateColumnId: dateColumn?.id, row, page, lockedKeys,
    canCreate: can(permission, 'write', 'create'), canConfigure: can(permission, 'write', 'update'),
    canEdit: Boolean(rowPermission && can(rowPermission, 'write', 'update') && can(permission, 'write', 'edit_subpages')),
    titleLocked: Boolean(titleLock?.locked && !titleLock.canEdit) || (!request.rowId && lockedKeys.has('title'))}
}
