/** Standalone development preview: no auth session, backend calls or persistence. */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans/index.css'
import '../index.css'
import { SchedulePreviewPage } from '@/pages/app/schedule/SchedulePage'
import { createScheduleMock } from '@/pages/app/schedule/mockData'
import { CalendarView, type HeaderCol, type RowData } from 'cubs-database'

const columns: HeaderCol[] = [
  { id: 'title', key: 'title', title: 'Título', type: 'text' },
  { id: 'date', title: 'Período', type: 'date' },
  { id: 'status', title: 'Status', type: 'select', options: [{ id: 'doing', label: 'Em andamento', color: 'blue' }] },
  { id: 'done', title: 'Concluído', type: 'checkbox' },
]
const rows: RowData[] = createScheduleMock().filter((item) => item.type === 'page').map((item, index) => {
  const start = item.allDay ? `${item.start}T00:00:00.000Z` : item.start
  const end = new Date(item.end ?? start)
  if (item.allDay) end.setUTCDate(end.getUTCDate() - 1)
  return { id: item.id, cells: { title: { value: item.title }, date: { value: `${start}@${end.toISOString()}` }, status: { value: 'doing' }, done: { value: index % 2 === 0 } } }
})

export function CalendarPreview() {
  const [dark, setDark] = useState(false)
  const [database, setDatabase] = useState(false)
  const [narrow, setNarrow] = useState(false)
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  return <div className={dark ? 'dark' : ''}>
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-divider px-3 py-1.5 text-xs">
        <span className="font-semibold">Cub’s · Calendar preview</span>
        <button onClick={() => setDatabase(!database)} className="rounded bg-contrast px-2 py-1">{database ? 'Ver /schedule' : 'Ver database'}</button>
        <button onClick={() => setDark(!dark)} className="rounded bg-contrast px-2 py-1">{dark ? 'Tema claro' : 'Tema escuro'}</button>
        <button onClick={() => setNarrow(!narrow)} className="rounded bg-contrast px-2 py-1">{narrow ? 'Largura total' : 'Largura 390 px'}</button>
        <span className="ml-auto opacity-50">Dados locais</span>
      </div>
      <div className="mx-auto min-h-0 w-full flex-1 overflow-auto" style={{ maxWidth: narrow ? 390 : undefined }}>
        {database ? <CalendarView rows={rows} columns={columns} /> : <SchedulePreviewPage />}
      </div>
    </div>
  </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<CalendarPreview />)
