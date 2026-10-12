import { Icon } from '@iconify/react'
import { Popover, TextField, cn } from 'cubs-components'
import { memo, useEffect, useMemo, useState } from 'react'

import type { CellEditorProps, HeaderCol, RelationTarget } from '../../types'

const idsOf = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((id): id is string => typeof id === 'string')
  : []

export function RelationChips({ column, value, compact = true }: { column: HeaderCol; value: unknown; compact?: boolean }) {
  const ids = idsOf(value)
  if (!ids.length) return <span className="opacity-60">—</span>
  const limit = compact ? 2 : ids.length
  return <span className="flex min-w-0 items-center gap-1 overflow-hidden">
    {ids.slice(0, limit).map((id) => <span key={id} className="max-w-32 truncate rounded-md bg-p-purple-500/10 px-1.5 py-0.5 text-xs text-p-purple-700 dark:text-p-purple-300">
      {column.relationTargets?.[id]?.title || 'Sem título'}
    </span>)}
    {ids.length > limit ? <span className="shrink-0 text-xs opacity-60">+{ids.length - limit}</span> : null}
  </span>
}

export const RelationCellEditor = memo(function RelationCellEditor({ column, value, onCommit }: CellEditorProps) {
  const selected = idsOf(value)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<RelationTarget[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !column.loadRelationOptions) return
    let alive = true
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      void column.loadRelationOptions?.({ search: search.trim() || undefined, limit: 50 })
        .then((page) => {
          if (!alive) return
          setItems(page.items)
          setNextCursor(page.nextCursor)
        })
        .catch(() => { if (alive) setError('Não foi possível carregar as páginas.') })
        .finally(() => { if (alive) setLoading(false) })
    }, 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [column, open, search])

  const merged = useMemo(() => {
    const known = new Map<string, RelationTarget>()
    Object.values(column.relationTargets ?? {}).forEach((target) => known.set(target.id, target))
    items.forEach((target) => known.set(target.id, target))
    return [...known.values()]
  }, [column.relationTargets, items])

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((candidate) => candidate !== id) : [...selected, id]
    onCommit(next.length ? next : null)
  }

  const loadMore = () => {
    if (!nextCursor || !column.loadRelationOptions || loading) return
    setLoading(true)
    setError(null)
    void column.loadRelationOptions({ search: search.trim() || undefined, cursor: nextCursor, limit: 50 })
      .then((page) => {
        setItems((current) => {
          const known = new Set(current.map((item) => item.id))
          return [...current, ...page.items.filter((item) => !known.has(item.id))]
        })
        setNextCursor(page.nextCursor)
      })
      .catch(() => setError('Não foi possível carregar mais páginas.'))
      .finally(() => setLoading(false))
  }

  return <Popover open={open} onOpenChange={setOpen} className="w-72" trigger={
    <button type="button" aria-label={column.title} className="flex h-full w-full items-center px-2.5 py-1.5 text-left">
      <RelationChips column={column} value={value} />
    </button>
  }>
    <div className="grid gap-2">
      <TextField autoFocus size="sm" aria-label="Buscar páginas" placeholder="Buscar páginas" value={search}
        onChange={(event) => setSearch(event.target.value)} />
      <div className="max-h-64 overflow-y-auto">
        {merged.map((target) => {
          const checked = selected.includes(target.id)
          return <button key={target.id} type="button" onClick={() => toggle(target.id)}
            className={cn('flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-active', checked && 'bg-p-purple-500/10')}>
            <span className="truncate">{target.title || 'Sem título'}</span>
            {checked ? <Icon icon="lucide:check" className="size-4 shrink-0 text-p-purple" /> : null}
          </button>
        })}
        {!loading && merged.length === 0 ? <p className="px-2 py-4 text-center text-xs opacity-60">Nenhuma página encontrada</p> : null}
        {loading ? <p className="px-2 py-3 text-center text-xs opacity-60">Carregando…</p> : null}
        {error ? <p role="alert" className="px-2 py-2 text-center text-xs text-p-red">{error}</p> : null}
        {!loading && nextCursor ? <button type="button" onClick={loadMore}
          className="mt-1 w-full rounded px-2 py-2 text-center text-xs font-medium text-p-purple hover:bg-active">
          Carregar mais
        </button> : null}
      </div>
    </div>
  </Popover>
})
