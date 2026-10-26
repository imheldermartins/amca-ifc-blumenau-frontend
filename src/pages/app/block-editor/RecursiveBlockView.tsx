import { useState } from 'react'
import { Button, Select, MentionTextField, displayMentionText, type MentionInputConfig } from 'cubs-components'
import { useModal } from '@/hooks/useModal'
import { useOptionalMention } from '@/hooks/useMention'
import { i18n } from '@/lib/i18n'
import { defaultRecursiveConfig, readRecursiveConfig, recursiveToken, recursiveCalendarHtml, recursiveTableHtml, RECURSIVE_CSS, type RecursiveConfig } from '@/shared/recursive-template'
import { pdfMentionOptions, recursiveMentionOptions, recursiveSampleRows } from './recursiveEditor'
import { useEditorEnvironment } from './editorEnvironmentContext'
import { RecursiveTableBlock } from './RecursiveTableBlock'
import { RecursiveBlockHelp } from './RecursiveBlockHelp'

export function RecursiveBlockView({ kind, value, onChange, onDelete, readOnly = false }: { kind: 'tableRecursive' | 'calendarRecursive'; value: unknown; onChange: (config: RecursiveConfig) => void; onDelete: () => void; readOnly?: boolean }) {
  if (kind === 'tableRecursive') return <RecursiveTableBlock value={value} onChange={onChange} onDelete={onDelete} readOnly={readOnly} />
  return <CalendarRecursiveBlockView kind={kind} value={value} onChange={onChange} onDelete={onDelete} readOnly={readOnly} />
}
function CalendarRecursiveBlockView({ kind, value, onChange, onDelete, readOnly = false }: { kind: 'tableRecursive' | 'calendarRecursive'; value: unknown; onChange: (config: RecursiveConfig) => void; onDelete: () => void; readOnly?: boolean }) {
  const { recursiveRelations = [], recursiveColumns: pageColumns = [] } = useEditorEnvironment()
  const parent = useOptionalMention()
  const { openModal } = useModal()
  const [editing, setEditing] = useState(false)
  const config = readRecursiveConfig(value), calendar = kind === 'calendarRecursive'
  const relation = recursiveRelations.find((entry) => entry.id === config.relationColumnId)
  const recursiveColumns = relation?.columns ?? []
  const hasRelations = recursiveRelations.length > 0
  const options = [...pdfMentionOptions(pageColumns), ...recursiveMentionOptions(recursiveColumns, relation?.id, relation?.name)]
  const labels = new Map([...options, ...recursiveMentionOptions(recursiveColumns)].map((option) => [option.id, option.label]))
  const mentions: MentionInputConfig = { options: [...(parent?.options ?? []), ...options], token: recursiveToken,
    resolve: (text) => displayMentionText(text, (token) => labels.get(token.slice(2, -1)) ?? parent?.resolve(token) ?? i18n('mentions.unavailable'), i18n('mentions.unavailable')),
    unavailable: i18n('mentions.unavailable'), label: i18n('mentions.label'), empty: i18n('mentions.empty') }
  const update = (index: number, patch: Partial<RecursiveConfig['fields'][number]>) => onChange({ ...config, fields: config.fields.map((field, i) => i === index ? { ...field, ...patch } : field) })
  const move = (index: number, delta: number) => {
    const fields = [...config.fields], other = index + delta
    if (other < 0 || other >= fields.length) return
    ;[fields[index], fields[other]] = [fields[other]!, fields[index]!]
    onChange({ ...config, fields })
  }
  const dateMissing = config.dateColumnId && !recursiveColumns.some((col) => col.id === config.dateColumnId && col.type === 'date')
  const preview = () => openModal({ size: 'xl', content: <section className="space-y-4 bg-white p-4 text-gray-900">
    <h2 className="text-lg font-semibold">{i18n(calendar ? 'recursive.calendar' : 'recursive.table')}</h2><p className="text-sm text-gray-500">{i18n('recursive.fictional')}</p>
    <style>{RECURSIVE_CSS}</style><div data-recursive-preview dangerouslySetInnerHTML={{ __html: calendar ? recursiveCalendarHtml(config, recursiveSampleRows(recursiveColumns)) : recursiveTableHtml(config, recursiveSampleRows(recursiveColumns)) }} />
  </section> })
  return <div contentEditable={false} className="min-w-0" data-recursive-block={kind}>
    <header className="flex flex-wrap items-center justify-between gap-2">
      <span className="flex min-w-0 flex-wrap items-center gap-2">
        {!readOnly && <Select aria-label={i18n('recursive.relation')} value={config.relationColumnId ?? ''} placeholder={i18n('recursive.choose-relation')} disabled={!hasRelations}
          className="w-48 max-w-full [&_button]:h-8 [&_button]:text-xs" onValueChange={(id) => onChange({ ...defaultRecursiveConfig(), relationColumnId: id })}
          options={[...(config.relationColumnId && !relation ? [{ value: config.relationColumnId, label: i18n('recursive.removed'), disabled: true }] : []), ...recursiveRelations.map((entry) => ({ value: entry.id, label: entry.name }))]} />}
        <span className="sr-only">{i18n(calendar ? 'recursive.calendar' : 'recursive.table')}</span><RecursiveBlockHelp kind={calendar ? 'calendar' : 'table'} />
      </span>
      <div className="flex flex-wrap gap-1">{!readOnly && <Button type="button" variant="text" disabled={!hasRelations} onClick={() => setEditing(!editing)}>{i18n('recursive.configure')}</Button>}<Button type="button" variant="text" disabled={!relation || Boolean(calendar && (!config.dateColumnId || dateMissing))} onClick={preview}>{i18n('recursive.preview')}</Button>{!readOnly && <Button type="button" variant="text" aria-label={i18n('recursive.remove-block')} onClick={onDelete}>×</Button>}</div>
    </header>
    {!hasRelations && <p className="my-2 text-xs opacity-60">{i18n('recursive.no-relations')}</p>}
    <div data-recursive-skeleton aria-label={i18n('recursive.skeleton')} className={`mt-3 grid gap-2 ${calendar ? 'grid-cols-7' : ''}`} style={calendar ? undefined : { gridTemplateColumns: `repeat(${Math.max(1, config.fields.length)}, minmax(0, 1fr))` }}>
      {(calendar ? Array.from({ length: 14 }, (_, i) => String(i < 7 ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i] : '')) : config.fields.map((field) => field.label)).map((label, i) => <div key={i} className="min-w-0 rounded border border-divider p-2"><span className="block truncate text-xs opacity-65">{label || '\u00a0'}</span><div className="mt-2 h-2 w-4/5 rounded bg-divider/70" /><div className="mt-2 h-2 w-3/5 rounded bg-divider/50" /></div>)}
    </div>
    {hasRelations && editing && !readOnly && <div className="mt-4 space-y-3 border-t border-divider pt-4">
      {relation && <>
      {calendar && <Select label={i18n('recursive.date')} aria-label={i18n('recursive.date')} value={config.dateColumnId ?? ''} placeholder={i18n('recursive.choose-date')}
        onValueChange={(id) => onChange({ ...config, dateColumnId: id })} options={[...(dateMissing ? [{ value: config.dateColumnId!, label: i18n('recursive.removed'), disabled: true }] : []), ...recursiveColumns.filter((col) => col.type === 'date').map((col) => ({ value: col.id, label: col.name }))]} />}
      {config.fields.map((field, index) => <fieldset key={field.id} className="min-w-0 space-y-2 rounded-lg border border-divider p-3">
        <legend className="px-1 text-xs opacity-60">{i18n(calendar ? 'recursive.property' : 'recursive.column')} {index + 1}</legend>
        <label className="grid gap-1 text-xs">{i18n('recursive.label')}<input aria-label={`${i18n('recursive.label')} ${index + 1}`} value={field.label} maxLength={120} className="rounded border border-divider bg-background p-2 text-sm" onChange={(event) => update(index, { label: event.target.value })} /></label>
        <MentionTextField label={i18n('recursive.content')} aria-label={`${i18n('recursive.content')} ${index + 1}`} value={field.text} maxLength={4000} onValueChange={(text) => update(index, { text })} mentions={mentions} placeholder={i18n('recursive.placeholder')} />
        <div className="flex gap-1"><Button type="button" variant="text" disabled={!index} aria-label={`${i18n('recursive.up')} ${index + 1}`} onClick={() => move(index, -1)}>↑</Button><Button type="button" variant="text" disabled={index === config.fields.length - 1} aria-label={`${i18n('recursive.down')} ${index + 1}`} onClick={() => move(index, 1)}>↓</Button><Button type="button" variant="text" disabled={!calendar && config.fields.length === 1} onClick={() => onChange({ ...config, fields: config.fields.filter((_, i) => i !== index) })}>{i18n('recursive.remove')}</Button></div>
      </fieldset>)}
      <Button type="button" variant="outlined" disabled={config.fields.length >= 40} onClick={() => onChange({ ...config, fields: [...config.fields, { id: crypto.randomUUID(), label: '', text: '' }] })}>{i18n(calendar ? 'recursive.add-property' : 'recursive.add-column')}</Button>
      </>}
    </div>}
  </div>
}
