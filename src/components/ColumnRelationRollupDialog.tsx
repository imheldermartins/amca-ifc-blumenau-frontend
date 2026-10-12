import { useEffect, useMemo, useState } from 'react'
import { Button, Select, TextField } from 'cubs-components'

import { Modal } from '@/components/Modal'
import { i18n } from '@/lib/i18n'
import { databaseService } from '@/services/DatabaseService'
import type { ColumnConfigPatch, HeaderCol, RollupOperation } from 'cubs-database'

export type ColumnRelationRollupTarget =
  | { mode: 'create'; type: 'relation' | 'rollup' }
  | { mode: 'update'; columnId: string; type: 'relation' | 'rollup' }

export function ColumnRelationRollupDialog({ target, workspaceId, columns, onOpenChange, onSave }: {
  target: ColumnRelationRollupTarget | null
  workspaceId?: string
  columns: HeaderCol[]
  onOpenChange: (open: boolean) => void
  onSave: (target: ColumnRelationRollupTarget, config: ColumnConfigPatch) => void
}) {
  const [databases, setDatabases] = useState<Array<{ id: string; title: string | null }>>([])
  const [databaseId, setDatabaseId] = useState('')
  const [databaseSearch, setDatabaseSearch] = useState('')
  const [databaseCursor, setDatabaseCursor] = useState<string | null>(null)
  const [databaseLoading, setDatabaseLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const relationColumns = useMemo(() => columns.filter((column) => column.type === 'relation' && column.relation), [columns])
  const [relationColumnId, setRelationColumnId] = useState('')
  const [operation, setOperation] = useState<RollupOperation>('count')
  const [numericColumns, setNumericColumns] = useState<Array<{ id: string; name: string | null }>>([])
  const [targetColumnId, setTargetColumnId] = useState('')

  useEffect(() => {
    if (!target || !workspaceId || target.type !== 'relation') return
    let alive = true
    const timer = setTimeout(() => {
      setDatabaseLoading(true)
      setError(null)
      void databaseService.listRelationDatabases(workspaceId, { search: databaseSearch.trim() || undefined, limit: 50 }).then((page) => {
        if (!alive) return
        setDatabases(page.items)
        setDatabaseCursor(page.nextCursor)
        setDatabaseId((current) => page.items.some((database) => database.id === current) ? current : page.items[0]?.id || '')
      }).catch(() => { if (alive) setError(i18n('pages.app.cubs-database.relation-config.erro-databases')) })
        .finally(() => { if (alive) setDatabaseLoading(false) })
    }, 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [databaseSearch, target, workspaceId])

  const loadMoreDatabases = () => {
    if (!workspaceId || !databaseCursor || databaseLoading) return
    setDatabaseLoading(true)
    setError(null)
    void databaseService.listRelationDatabases(workspaceId, { search: databaseSearch.trim() || undefined, cursor: databaseCursor, limit: 50 })
      .then((page) => {
        setDatabases((current) => {
          const known = new Set(current.map((database) => database.id))
          return [...current, ...page.items.filter((database) => !known.has(database.id))]
        })
        setDatabaseCursor(page.nextCursor)
      })
      .catch(() => setError(i18n('pages.app.cubs-database.relation-config.erro-mais-databases')))
      .finally(() => setDatabaseLoading(false))
  }

  useEffect(() => {
    if (!target || target.type !== 'rollup') return
    setRelationColumnId((current) => current || relationColumns[0]?.id || '')
  }, [relationColumns, target])

  useEffect(() => {
    const relation = relationColumns.find((column) => column.id === relationColumnId)
    if (!target || target.type !== 'rollup' || !relation?.relation?.targetDatabaseId || operation === 'count') {
      setNumericColumns([]); setTargetColumnId(''); return
    }
    let alive = true
    setError(null)
    void databaseService.getColumns(relation.relation.targetDatabaseId).then((remote) => {
      if (!alive) return
      const numeric = remote.filter((column) => column.type === 'numeric').map((column) => ({ id: column.id, name: column.name }))
      setNumericColumns(numeric)
      setTargetColumnId((current) => numeric.some((column) => column.id === current) ? current : numeric[0]?.id || '')
    }).catch(() => { if (alive) setError(i18n('pages.app.cubs-database.relation-config.erro-propriedades')) })
    return () => { alive = false }
  }, [operation, relationColumnId, relationColumns, target])

  const canSave = target?.type === 'relation' ? Boolean(databaseId)
    : Boolean(relationColumnId && (operation === 'count' || targetColumnId))
  const save = () => {
    if (!target || !canSave) return
    onSave(target, target.type === 'relation'
      ? { relation: { version: 1, targetDatabaseId: databaseId } }
      : { rollup: { version: 1, relationColumnId, operation, ...(operation !== 'count' && { targetColumnId }) } })
    onOpenChange(false)
  }

  const title = target?.type === 'relation'
    ? i18n('pages.app.cubs-database.relation-config.titulo-relacao')
    : i18n('pages.app.cubs-database.relation-config.titulo-resumo')

  return <Modal open={Boolean(target)} onOpenChange={onOpenChange} size="sm" accessibleTitle={title}>
    <h2 className="text-lg font-semibold">{title}</h2>
    <p className="mt-1 text-sm opacity-60">{target?.type === 'relation'
      ? i18n('pages.app.cubs-database.relation-config.descricao-relacao')
      : i18n('pages.app.cubs-database.relation-config.descricao-resumo')}</p>
    <div className="mt-4 grid gap-4">
      {error ? <p role="alert" className="text-sm text-p-red">{error}</p> : null}
      {target?.type === 'relation' ? <>
        <TextField label={i18n('pages.app.cubs-database.relation-config.buscar-database')} value={databaseSearch} placeholder={i18n('pages.app.cubs-database.relation-config.buscar-placeholder')}
          onChange={(event) => setDatabaseSearch(event.target.value)} />
        <Select label={i18n('pages.app.cubs-database.relation-config.database-destino')} value={databaseId}
          options={databases.map((database) => ({ value: database.id, label: database.title || i18n('pages.app.pagina.sem-titulo') }))}
          onValueChange={setDatabaseId} />
        {databaseCursor ? <Button variant="text" color="purple" disabled={databaseLoading} onClick={loadMoreDatabases}>
          {databaseLoading ? i18n('pages.app.cubs-database.relation-config.carregando') : i18n('pages.app.cubs-database.relation-config.carregar-mais')}
        </Button> : null}
      </> : <>
        <Select label={i18n('pages.app.cubs-database.tipos.relation')} value={relationColumnId}
          options={relationColumns.map((column) => ({ value: column.id, label: column.title }))}
          onValueChange={setRelationColumnId} />
        <Select label={i18n('pages.app.cubs-database.relation-config.calculo')} value={operation}
          options={[{ value: 'count', label: i18n('pages.app.cubs-database.relation-config.contagem') }, { value: 'sum', label: i18n('pages.app.cubs-database.relation-config.soma') }, { value: 'min', label: i18n('pages.app.cubs-database.relation-config.minimo') }, { value: 'max', label: i18n('pages.app.cubs-database.relation-config.maximo') }]}
          onValueChange={(value) => setOperation(value as RollupOperation)} />
        {operation !== 'count' ? <Select label={i18n('pages.app.cubs-database.relation-config.propriedade-numerica')} value={targetColumnId}
          options={numericColumns.map((column) => ({ value: column.id, label: column.name || i18n('pages.app.cubs-database.relation-config.sem-nome') }))}
          onValueChange={setTargetColumnId} /> : null}
      </>}
    </div>
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="text" color="from-theme" onClick={() => onOpenChange(false)}>{i18n('pages.app.cubs-database.relation-config.cancelar')}</Button>
      <Button variant="filled" color="purple" disabled={!canSave} onClick={save}>{i18n('pages.app.cubs-database.relation-config.salvar')}</Button>
    </div>
  </Modal>
}
