/** Isolated visual QA of the production calendar/modal/editor components. No API writes. */
import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import '@fontsource-variable/noto-sans/index.css'
import '../index.css'
import {Button, type CalendarCreateSelection} from 'cubs-components'
import {CubsDatabase, calendarSelectionValue, emptyViewFilters, type HeaderCol, type RowData} from 'cubs-database'
import {ModalProvider} from '@/contexts/ModalContext'
import {useModal} from '@/hooks/useModal'
import {PagePropertiesForm} from '@/components/PagePropertiesForm'
import {ScheduleSurface} from '@/pages/app/schedule/SchedulePage'
import type {ScheduleItem} from '@/pages/app/schedule/types'
import {reorderByIds} from '@/shared/cubs-database/utils'

const columns: HeaderCol[] = [
  {id: 'title', key: 'title', title: 'Título', type: 'text'},
  {id: 'date', title: 'Agendado para', type: 'date'},
  {id: 'notes', title: 'Descrição', type: 'text'},
  {id: 'status', title: 'Status', type: 'select', options: [{id: 'doing', label: 'Em andamento', color: 'blue'}, {id: 'done', label: 'Concluído', color: 'green'}]},
  {id: 'value', title: 'Valor', type: 'numeric', format: 'currency', currency: 'BRL'},
  {id: 'checked', title: 'Confirmado', type: 'checkbox'},
  {id: 'relation', title: 'Relacionadas', type: 'relation', relation: {version: 1, targetDatabaseId: 'preview', cardinality: 'many'}, relationTargets: {target: {id: 'target', title: 'Página relacionada'}}, loadRelationOptions: async () => ({items: [{id: 'target', title: 'Página relacionada'}], nextCursor: null})},
]
export function PreviewForm({initial, initialColumns, close, save, saveOrder, onSortingChange}: {initial: RowData; initialColumns: HeaderCol[]; close: () => void; save: (row: RowData) => void; saveOrder: (order: string[]) => void; onSortingChange: (active: boolean) => void}) {
  const [row, setRow] = useState(initial)
  const [title, setTitle] = useState(String(initial.cells.title?.value ?? ''))
  const [orderedColumns, setColumns] = useState(initialColumns)
  return <PagePropertiesForm destinationLabel="Workspace de teste" title={title} onTitleChange={setTitle} columns={orderedColumns} row={row}
    onChange={change => setRow(current => ({...current, cells: {...current.cells, [change.columnId]: {value: change.value}}}))}
    onOrderChange={order => {setColumns(current => reorderByIds(current, order)); saveOrder(order)}} onSortingChange={onSortingChange}
    footer={<div className="flex justify-end gap-2"><Button onClick={close}>Cancelar</Button><Button color="purple" onClick={() => {save({...row, cells: {...row.cells, title: {value: title}}}); close()}}>{initial.id === 'draft' ? 'Criar' : 'Concluir'}</Button></div>} />
}
export function Preview() {
  const {openModal} = useModal()
  const [database, setDatabase] = useState(true)
  const [rows, setRows] = useState<RowData[]>([])
  const [columnOrder, setColumnOrder] = useState(columns.map(column => column.id))
  const [dark, setDark] = useState(false)
  const open = (selection?: CalendarCreateSelection, existing?: RowData) => openModal({size: 'lg', content: ({closeModal, updateModal}) => <PreviewForm
    initialColumns={reorderByIds(columns, columnOrder)} saveOrder={setColumnOrder} onSortingChange={active => updateModal({dismissible: !active})}
    initial={existing ?? {id: 'draft', cells: selection ? {date: {value: calendarSelectionValue(selection)}} : {}}} close={closeModal}
    save={row => setRows(current => [...current.filter(candidate => candidate.id !== row.id), {...row, id: row.id === 'draft' ? crypto.randomUUID() : row.id}])} />})
  const items: ScheduleItem[] = rows.filter(row => row.cells.date?.value).map(row => {
    const [start, end] = String(row.cells.date!.value).split('@')
    return {id: row.id, type: 'page', title: String(row.cells.title?.value || 'Sem Título'), start, end, allDay: !end, data: {page: {id: row.id, title: String(row.cells.title?.value || 'Sem Título')}, sourcePageId: 'base', dateColumnId: 'date', properties: []}}
  })
  return <div className={dark ? 'dark' : ''}><div className="flex h-dvh flex-col bg-background text-foreground">
    <header className="flex flex-wrap gap-3 border-b border-divider p-3 text-sm"><strong>Prévia local · sem persistência</strong><button onClick={() => setDatabase(!database)}>{database ? 'Ver Agenda' : 'Ver database'}</button><button onClick={() => {setDark(!dark); document.documentElement.classList.toggle('dark', !dark)}}>Alternar tema</button><output aria-label="Páginas criadas">{rows.length} páginas</output></header>
    <div className="min-h-0 flex-1 overflow-auto">{database ? <CubsDatabase pageId="base" pageTitle="Workspace de teste" headerCols={columns} rows={rows} settings={{calendar: {view: 'calendar', name: 'Calendário', dateColumnId: 'date', orderedHeaderCols: columns.map(column => column.id), filters: emptyViewFilters(), urlKey: {key: 'calendario', aliases: []}}}}
      onRequestCreateRow={request => open(request.selection)} onCalendarEditRow={row => open(undefined, row)} onAddRow={() => {throw new Error('Calendar + must use its modal trigger')}} />
      : <ScheduleSurface items={items} pinnedIds={new Set(rows.map(row => row.id))} onPin={() => true} onUnpin={() => true} onCreate={selection => open(selection)} onEditPage={item => open(undefined, rows.find(row => row.id === item.id))} />}</div>
  </div></div>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<ModalProvider><Preview /></ModalProvider>)
