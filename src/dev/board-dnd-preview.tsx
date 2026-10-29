/** Production Board without APIs or persistence; browser diagnostics only. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/noto-sans/index.css'
import '../index.css'
import { BoardView } from '../shared/cubs-database/components/BoardView'
import type { BoardMoveInput, HeaderCol, RowData } from '../shared/cubs-database/types'

const SELECT = '01KXVZ00000000000000000001'
const FIRST = '01KXVZ00000000000000000002'
const SECOND = '01KXVZ00000000000000000003'
const count = Math.max(2, Math.min(1000, Number(new URLSearchParams(location.search).get('cards')) || 20))
const columns: HeaderCol[] = [
  { id: 'title', key: 'title', title: 'Nome', type: 'text' },
  { id: SELECT, title: 'Status', type: 'select', options: [{ id: FIRST, label: 'Primeiro', color: 'blue' }, { id: SECOND, label: 'Segundo', color: 'orange' }] },
]
const initial: RowData[] = Array.from({ length: count }, (_, i) => ({ id: `row-${i}`, cells: { title: { value: `Página ${i}` }, [SELECT]: { value: i < count / 2 ? FIRST : SECOND } } }))
const config = { propertyIds: [] }
const noChange = () => {}
export function Preview() {
  const [moves, setMoves] = useState<BoardMoveInput[]>([])
  return <main className="min-h-screen bg-background p-4 text-foreground">
    <h1 className="text-xl font-semibold">Board · diagnóstico local</h1>
    <p className="mb-3 text-sm">{count} cards · sem API · Espaço inicia, setas movem, Escape cancela.</p>
    <output data-moves={moves.length} className="mb-3 block text-sm">Movimentações confirmadas: {moves.length}</output>
    <BoardView columns={columns} rows={initial} config={config} onMove={async input => { setMoves(current => [...current, input]) }} onCellChange={noChange} onConfigChange={noChange} onCreateRow={async () => undefined} />
    <pre data-move-log className="text-xs">{JSON.stringify(moves)}</pre>
  </main>
}
if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Preview />)
