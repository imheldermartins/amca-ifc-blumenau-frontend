import { Icon } from '@iconify/react'
import { Popover, TextField, cn } from 'cubs-components'
import { memo, useEffect, useRef, useState } from 'react'

import type { CellEditorProps, HeaderCol, RelationTarget } from '../../types'
import { DatabaseMentionText } from '../../mentions'

const idsOf = (value: unknown): string[] => Array.isArray(value)
  ? value.filter((id): id is string => typeof id === 'string')
  : []

interface OptionsState {
  scope: string
  items: RelationTarget[]
  nextCursor: string | null
  loading: boolean
  error: string | null
}

export function RelationChips({ column, value, compact = true }: { column: HeaderCol; value: unknown; compact?: boolean }) {
  const ids = idsOf(value)
  if (!ids.length) return <span className="opacity-60">—</span>
  const limit = compact ? 2 : ids.length
  return <span className="flex min-w-0 items-center gap-1 overflow-hidden">
    {ids.slice(0, limit).map((id) => <span key={id} className="max-w-32 truncate rounded-md bg-p-purple-500/10 px-1.5 py-0.5 text-xs text-p-purple-700 dark:text-p-purple-300">
      <DatabaseMentionText value={column.relationTargets?.[id] ? column.relationTargets[id].title || 'Sem título' : 'Carregando…'} />
    </span>)}
    {ids.length > limit ? <span className="shrink-0 text-xs opacity-60">+{ids.length - limit}</span> : null}
  </span>
}

export const RelationCellEditor = memo(function RelationCellEditor({ column, value, onCommit, inputId, disabled = false }: CellEditorProps & { inputId?: string; disabled?: boolean }) {
  const selected = idsOf(value)
  const [requestedOpen, setOpen] = useState(false)
  const open = requestedOpen && !disabled
  useEffect(() => { if (disabled) setOpen(false) }, [disabled])
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<OptionsState | null>(null)
  const destination = JSON.stringify([column.id, column.relation?.targetDatabaseId])
  const [selectedTitles, setSelectedTitles] = useState<{ destination: string; targets: Record<string, RelationTarget> }>({ destination, targets: {} })
  const loader = useRef(column.loadRelationOptions)
  loader.current = column.loadRelationOptions
  const hasLoader = Boolean(column.loadRelationOptions)
  const request = useRef<{ active: boolean; paging: boolean } | null>(null)
  const query = search.trim() || undefined
  const scope = JSON.stringify([column.id, column.relation?.targetDatabaseId, query, open])
  const current = options?.scope === scope ? options : null
  // relationTargets is a projection-wide title lookup, not this relation's catalog.
  const items = column.loadRelationOptions ? current?.items ?? [] : []
  const nextCursor = current?.nextCursor
  const loading = !!(open && column.loadRelationOptions && (!current || current.loading))
  const error = current?.error

  useEffect(() => {
    const loadOptions = loader.current
    if (!open || !loadOptions) {
      setOptions(null)
      return
    }
    const session = { active: true, paging: false }
    request.current = session
    setOptions({ scope, items: [], nextCursor: null, loading: true, error: null })
    const timer = setTimeout(() => {
      void loadOptions({ search: query, limit: 50 })
        .then((page) => {
          if (!session.active) return
          setOptions({ scope, ...page, loading: false, error: null })
        })
        .catch(() => {
          if (session.active) setOptions({
            scope, items: [], nextCursor: null, loading: false, error: 'Não foi possível carregar as páginas.',
          })
        })
    }, 180)
    return () => { session.active = false; clearTimeout(timer) }
  }, [hasLoader, open, query, scope])

  const toggle = (target: RelationTarget) => {
    const { id } = target
    const next = selected.includes(id) ? selected.filter((candidate) => candidate !== id)
      : column.relation?.cardinality === 'one' ? [id] : [...selected, id]
    // Keep display metadata through search/close while the authoritative
    // projection catches up. It must never become the selectable catalog.
    setSelectedTitles((previous) => {
      const known = { ...(previous.destination === destination ? previous.targets : {}), ...column.relationTargets, [id]: target }
      return { destination, targets: Object.fromEntries(next.filter((key) => known[key]).map((key) => [key, known[key]])) }
    })
    onCommit(next.length ? next : null)
  }

  const loadMore = () => {
    const session = request.current
    if (!nextCursor || !column.loadRelationOptions || loading || !session?.active || session.paging) return
    session.paging = true
    setOptions((previous) => previous?.scope === scope ? { ...previous, loading: true, error: null } : previous)
    void column.loadRelationOptions({ search: query, cursor: nextCursor, limit: 50 })
      .then((page) => {
        if (!session.active) return
        setOptions((previous) => {
          if (previous?.scope !== scope) return previous
          const known = new Set(previous.items.map((item) => item.id))
          return { ...previous, items: [...previous.items, ...page.items.filter((item) => !known.has(item.id))], nextCursor: page.nextCursor }
        })
      })
      .catch(() => {
        if (session.active) setOptions((previous) => previous?.scope === scope
          ? { ...previous, error: 'Não foi possível carregar mais páginas.' } : previous)
      })
      .finally(() => {
        session.paging = false
        if (session.active) setOptions((previous) => previous?.scope === scope ? { ...previous, loading: false } : previous)
      })
  }

  return <Popover open={open} onOpenChange={setOpen} className="w-72" trigger={
    <button id={inputId} type="button" disabled={disabled} aria-label={column.title} className="flex h-full w-full items-center px-2.5 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-50">
      <RelationChips column={{
        ...column,
        relationTargets: { ...(selectedTitles.destination === destination ? selectedTitles.targets : {}), ...column.relationTargets },
      }} value={value} />
    </button>
  }>
    <div className="grid gap-2">
      <TextField autoFocus size="sm" aria-label="Buscar páginas" placeholder="Buscar páginas" value={search}
        onChange={(event) => setSearch(event.target.value)} />
      <div className="max-h-64 overflow-y-auto">
        {items.map((target) => {
          const checked = selected.includes(target.id)
          return <button key={target.id} type="button" onClick={() => toggle(target)}
            className={cn('flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-active', checked && 'bg-p-purple-500/10')}>
            <span className="truncate"><DatabaseMentionText value={target.title || 'Sem título'} /></span>
            {checked ? <Icon icon="lucide:check" className="size-4 shrink-0 text-p-purple" /> : null}
          </button>
        })}
        {!loading && !error && items.length === 0 ? <p className="px-2 py-4 text-center text-xs opacity-60">Nenhuma página encontrada</p> : null}
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
