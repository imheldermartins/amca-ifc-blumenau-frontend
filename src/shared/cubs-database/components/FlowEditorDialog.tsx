import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, UIEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { Button, Select, cn } from 'cubs-components'

import type {
  ColumnDataType,
  FlowConditionOperator,
  FlowDefinition,
  FlowExecutionResult,
  FlowMacroOption,
  FlowMacroScope,
  FlowMacroSection,
  FlowMacroSectionsBuilder,
  FlowNode,
  FlowNodeType,
  HeaderCol,
  RowData,
} from '../types'
import { createDefaultFlowDefinition } from '../flowDefinition'
import {
  createFlowMacroScope,
  createFlowMacroSections,
  createMacroMentionMaps,
  formatMacroMentions,
  parseMacroMentions,
} from '../macroMentions'
import { useSortableSensors } from './dndSensors'

const NODE_LABELS: Record<FlowNodeType, string> = {
  start: 'Início',
  email: 'Enviar e-mail',
  set_value: 'Atualizar propriedade',
  switch: 'Condição',
  callback: 'Retorno',
}

const NODE_ICONS: Record<FlowNodeType, string> = {
  start: 'lucide:play',
  email: 'lucide:mail',
  set_value: 'lucide:pencil-line',
  switch: 'lucide:git-branch',
  callback: 'lucide:circle-check',
}

const CONDITION_OPTIONS: { value: FlowConditionOperator; label: string }[] = [
  { value: 'equals', label: 'É igual a' },
  { value: 'not_equals', label: 'É diferente de' },
  { value: 'contains', label: 'Contém' },
  { value: 'greater_than', label: 'É maior que' },
  { value: 'less_than', label: 'É menor que' },
  { value: 'is_empty', label: 'Está vazio' },
  { value: 'is_not_empty', label: 'Não está vazio' },
]

type FlowSetValueColumnType = Extract<ColumnDataType, 'text' | 'numeric' | 'select' | 'checkbox'>

const SET_VALUE_COLUMN_TYPES = new Set<ColumnDataType>([
  'text',
  'numeric',
  'select',
  'checkbox',
])

function isSetValueColumn(column: HeaderCol): column is HeaderCol & { type: FlowSetValueColumnType } {
  return column.key !== 'title'
    && column.type !== undefined
    && SET_VALUE_COLUMN_TYPES.has(column.type)
}

function nodeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `flow-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/**
 * A ordem visual é também a trilha principal do Flow. Toda mudança recompõe
 * as ligações; o único desvio v1 é a condição, cujo false encerra no callback.
 * O backend valida de novo e é a autoridade final sobre o grafo.
 */
function linkNodes(nodes: FlowNode[]): FlowNode[] {
  const callback = nodes.find((node) => node.type === 'callback')
  return nodes.map((node, index) => {
    const nextNodeId = nodes[index + 1]?.id ?? callback?.id ?? ''
    if (node.type === 'start' || node.type === 'email' || node.type === 'set_value') {
      return { ...node, config: { ...node.config, nextNodeId } } as FlowNode
    }
    if (node.type === 'switch') {
      return {
        ...node,
        config: {
          ...node.config,
          trueTargetId: nextNodeId,
          falseTargetId: callback?.id ?? nextNodeId,
        },
      }
    }
    return node
  })
}

function createAction(type: Exclude<FlowNodeType, 'start' | 'callback'>): FlowNode {
  const id = nodeId()
  if (type === 'email') {
    return { id, type, config: { to: '', subject: '', body: '', nextNodeId: '' } }
  }
  if (type === 'set_value') {
    return { id, type, config: { columnId: '', value: '', nextNodeId: '' } }
  }
  return {
    id,
    type,
    config: {
      left: '',
      operator: 'equals',
      right: '',
      trueTargetId: '',
      falseTargetId: '',
    },
  }
}

interface MacroFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  sections: FlowMacroSection[]
  multiline?: boolean
  placeholder?: string
}

function MacroHighlight({ value, multiline }: { value: string; multiline?: boolean }) {
  const parts = value.split(/(@\{[^}\r\n]+\})/g)
  return <>
    {parts.map((part, index) => part.startsWith('@{') && part.endsWith('}')
      ? <span key={`${part}-${index}`} className="rounded bg-p-purple-500/10 text-p-purple ring-1 ring-inset ring-p-purple-500/15">{part}</span>
      : <span key={`text-${index}`} className="text-foreground">{part}</span>)}
    {multiline && value.endsWith('\n') ? '\u200b' : null}
  </>
}

function MacroField({ label, value, onChange, sections, multiline, placeholder }: MacroFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  const fieldId = useId()
  const listboxId = useId()
  const macros = useMemo(() => sections.flatMap((section) => section.options), [sections])
  const [displayValue, setDisplayValue] = useState(() => formatMacroMentions(value, macros))
  const [caret, setCaret] = useState(displayValue.length)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const beforeCaret = displayValue.slice(0, caret)
  const match = beforeCaret.match(/@([\p{L}\p{N}_.-]*)$/u)
  const query = match?.[1]?.toLowerCase() ?? ''
  const mentionMaps = useMemo(() => createMacroMentionMaps(macros), [macros])
  const grouped = match
    ? sections.flatMap((section) => {
        const options = section.options.filter((macro) => {
          const mention = mentionMaps.canonicalToMention.get(macro.token) ?? ''
          return `${mention} ${macro.token} ${macro.label}`.toLowerCase().includes(query)
        })
        return options.length ? [{ ...section, options }] : []
      })
    : []
  const suggestions = grouped.flatMap((section) => section.options)

  useEffect(() => {
    setDisplayValue(formatMacroMentions(value, macros))
  }, [macros, value])

  useEffect(() => {
    setActiveIndex(0)
  }, [menuOpen, query, suggestions.length])

  const readCaret = () => setCaret(inputRef.current?.selectionStart ?? value.length)
  const commitDisplayValue = (next: string) => {
    setDisplayValue(next)
    onChange(parseMacroMentions(next, macros))
  }
  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    commitDisplayValue(event.target.value)
    const nextCaret = event.target.selectionStart ?? event.target.value.length
    setCaret(nextCaret)
    setMenuOpen(/@([\p{L}\p{N}_.-]*)$/u.test(event.target.value.slice(0, nextCaret)))
  }
  const insert = (macro: FlowMacroOption) => {
    if (!match) return
    const start = caret - match[0].length
    const mention = mentionMaps.canonicalToMention.get(macro.token) ?? macro.token
    const next = `${displayValue.slice(0, start)}${mention}${displayValue.slice(caret)}`
    const nextCaret = start + mention.length
    commitDisplayValue(next)
    setCaret(nextCaret)
    setMenuOpen(false)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!menuOpen || suggestions.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + direction + suggestions.length) % suggestions.length)
      return
    }
    if (event.key === 'Enter' && suggestions[activeIndex]) {
      event.preventDefault()
      insert(suggestions[activeIndex])
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setMenuOpen(false)
    }
  }

  const syncScroll = (event: UIEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!highlightRef.current) return
    highlightRef.current.scrollTop = event.currentTarget.scrollTop
    highlightRef.current.scrollLeft = event.currentTarget.scrollLeft
  }

  const wrapperClass = 'relative overflow-hidden rounded border border-divider bg-background focus-within:border-p-purple focus-within:ring-2 focus-within:ring-p-purple-500/20'
  const highlightClass = cn(
    'pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-2 text-sm leading-5',
    multiline ? 'whitespace-pre-wrap break-words' : 'whitespace-pre',
  )
  const fieldClass = cn(
    'relative z-10 w-full bg-transparent px-2.5 py-2 text-sm leading-5 text-transparent caret-foreground outline-none selection:bg-p-purple-500/25 placeholder:text-foreground/40',
    multiline && 'resize-y',
  )

  return (
    <div className="relative flex flex-col gap-1 text-xs font-medium">
      <label htmlFor={fieldId}>{label}</label>
      <span className={wrapperClass}>
        <div ref={highlightRef} aria-hidden="true" className={highlightClass}>
          <MacroHighlight value={displayValue} multiline={multiline} />
        </div>
        {multiline ? (
        <textarea
          id={fieldId}
          role="combobox"
          ref={(node) => { inputRef.current = node }}
          value={displayValue}
          rows={3}
          placeholder={placeholder}
          onChange={handleChange}
          onClick={readCaret}
          onKeyUp={readCaret}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onBlur={() => setMenuOpen(false)}
          aria-controls={menuOpen ? listboxId : undefined}
          aria-expanded={menuOpen}
          aria-activedescendant={menuOpen && suggestions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          className={fieldClass}
        />
      ) : (
        <input
          id={fieldId}
          role="combobox"
          ref={(node) => { inputRef.current = node }}
          value={displayValue}
          placeholder={placeholder}
          onChange={handleChange}
          onClick={readCaret}
          onKeyUp={readCaret}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onBlur={() => setMenuOpen(false)}
          aria-controls={menuOpen ? listboxId : undefined}
          aria-expanded={menuOpen}
          aria-activedescendant={menuOpen && suggestions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          className={fieldClass}
        />
      )}
      </span>
      {menuOpen && match && (
        <div id={listboxId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 flex max-h-64 flex-col overflow-hidden rounded-lg border border-divider bg-background shadow-xl shadow-dark-900/10">
          <div className="min-h-0 overflow-y-auto p-1">
          {grouped.length > 0 ? grouped.map(({ id, label: sectionLabel, options }) => (
            <div key={id} className="py-1">
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide opacity-50">
                {sectionLabel}
              </div>
              {options.map((macro) => {
                const optionIndex = suggestions.indexOf(macro)
                const active = optionIndex === activeIndex
                return (
                <button
                  key={macro.token}
                  id={`${listboxId}-${optionIndex}`}
                  role="option"
                  aria-selected={active}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(optionIndex)}
                  onClick={() => insert(macro)}
                  className={cn('flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs', active ? 'bg-p-purple-500/10 text-p-purple' : 'hover:bg-active')}
                >
                  <span className="min-w-0 truncate"><strong>{macro.label}</strong> <span className="text-p-purple opacity-70">{mentionMaps.canonicalToMention.get(macro.token)}</span></span>
                  {macro.preview != null && <span className="max-w-32 truncate opacity-45">{macro.preview}</span>}
                </button>
              )})}
            </div>
          )) : (
            <div className="px-2 py-3 text-xs opacity-55">Nenhuma macro encontrada.</div>
          )}
          </div>
          <div className="flex shrink-0 items-center gap-3 border-t border-divider px-3 py-1.5 text-[10px] opacity-55">
            <span className="inline-flex items-center gap-1"><Icon icon="lucide:arrow-up" /> <Icon icon="lucide:arrow-down" /> navegar</span>
            <span>Enter selecionar</span>
          </div>
        </div>
      )}
    </div>
  )
}

const PERSON_EMAIL_TOKEN = /^@people\.[0-9A-Za-z_-]+\.email$/

function isPersonRecipientOption(option: FlowMacroOption): boolean {
  return PERSON_EMAIL_TOKEN.test(option.token)
}

/**
 * O destinatário segue o contrato visual da coluna ativa, não apenas o tipo
 * informado pelo catálogo remoto. A coluna sintética de título é convertida
 * para a referência canônica `@page.title`, mas conserva nome, máscara e
 * preview da mesma forma que uma `page_column` comum.
 */
function createRecipientOptions(
  scope: FlowMacroScope,
  columns: HeaderCol[],
  row?: RowData,
): FlowMacroOption[] {
  const macrosByToken = new Map(
    [...scope.page, ...scope.columns].map((option) => [option.token, option]),
  )
  const columnRecipients = columns.flatMap((column) => {
    if (column.type !== 'text' || column.mask !== 'email') return []

    const token = column.key === 'title' ? '@page.title' : `@columns.${column.id}`
    const macro = macrosByToken.get(token)
    if (!macro) return []

    const cellValue = row?.cells[column.id]?.value
    return [{
      ...macro,
      token,
      label: column.title || macro.label,
      group: 'columns' as const,
      valueType: 'email' as const,
      preview:
        cellValue === null || cellValue === undefined || cellValue === ''
          ? macro.preview ?? null
          : String(cellValue),
    }]
  })

  return [
    ...scope.people.filter(isPersonRecipientOption),
    ...columnRecipients,
  ]
}

function parseRecipientTokens(value: string): string[] {
  return [...new Set(value.split(/[;,]/).map((token) => token.trim()).filter(Boolean))]
}

function recipientLabel(option: FlowMacroOption | undefined, token: string): string {
  return option?.label.replace(/\s*·\s*e-mail$/i, '') ?? token
}

interface RecipientFieldProps {
  value: string
  onChange: (value: string) => void
  options: FlowMacroOption[]
}

/**
 * Destinatários não são texto livre. O seletor aceita membros, o título da row
 * corrente e colunas text/mask=email que a API publicou no catálogo. O
 * documento persiste tokens canônicos separados por vírgula.
 */
function RecipientField({ value, onChange, options }: RecipientFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const recipients = options
  const byToken = useMemo(
    () => new Map(recipients.map((option) => [option.token, option])),
    [recipients],
  )
  const selectedTokens = parseRecipientTokens(value)
  const selected = new Set(selectedTokens)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const available = recipients.filter((option) => !selected.has(option.token) && (
    !normalizedQuery
    || `${option.label} ${option.preview ?? ''}`.toLocaleLowerCase().includes(normalizedQuery)
  ))

  const commit = (tokens: string[]) => onChange(tokens.join(', '))
  const add = (token: string) => {
    const next = [...selectedTokens, token]
    commit(next)
    setQuery('')
    if (next.length >= recipients.length) setOpen(false)
  }
  const remove = (token: string) => commit(selectedTokens.filter((candidate) => candidate !== token))

  return (
    <div
      className="relative grid gap-1 text-xs font-medium"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <span>Destinatários</span>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded border border-divider bg-background px-2 py-1.5 focus-within:border-p-purple focus-within:ring-2 focus-within:ring-p-purple-500/20">
        {selectedTokens.map((token) => {
          const option = byToken.get(token)
          return (
            <span key={token} className="inline-flex min-w-0 items-center gap-1 rounded-full bg-p-purple-500/10 px-2 py-1 text-xs font-medium text-p-purple ring-1 ring-inset ring-p-purple-500/15">
              <span className="max-w-48 truncate">{recipientLabel(option, token)}</span>
              <button
                type="button"
                aria-label={`Remover ${recipientLabel(option, token)}`}
                onClick={() => remove(token)}
                className="-mr-1 rounded-full p-0.5 opacity-60 hover:bg-p-purple-500/15 hover:opacity-100"
              >
                <Icon icon="lucide:x" fontSize={12} />
              </button>
            </span>
          )
        })}
        {!selectedTokens.length && <span className="px-0.5 text-sm font-normal opacity-45">Nenhum destinatário selecionado</span>}
        <button
          type="button"
          aria-label="Adicionar destinatário"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={recipients.every((option) => selected.has(option.token))}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            if (recipients.some((option) => !selected.has(option.token))) {
              setOpen((current) => !current)
            }
          }}
          className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-divider text-p-purple hover:border-p-purple/40 hover:bg-p-purple-500/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Icon icon="lucide:plus" fontSize={14} />
        </button>
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-divider bg-background p-1.5 shadow-xl shadow-dark-900/10">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                setOpen(false)
              }
            }}
            aria-label="Buscar destinatário"
            placeholder="Buscar destinatário"
            className="mb-1.5 h-8 w-full rounded border border-divider bg-background px-2 text-xs font-normal outline-none focus:border-p-purple focus:ring-2 focus:ring-p-purple-500/20"
          />
          <div role="listbox" aria-label="Destinatários disponíveis" className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
            {available.map((option) => (
              <button
                key={option.token}
                type="button"
                role="option"
                aria-selected={false}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation()
                  add(option.token)
                }}
                className="flex min-w-0 items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-active"
              >
                <strong className="min-w-0 truncate">{recipientLabel(option, option.token)}</strong>
                {option.preview && <span className="max-w-36 truncate opacity-45">{option.preview}</span>}
              </button>
            ))}
            {!available.length && (
              <span className="px-2 py-3 text-center text-xs font-normal opacity-50">
                Nenhum outro destinatário disponível.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function updateNode(nodes: FlowNode[], id: string, updater: (node: FlowNode) => FlowNode): FlowNode[] {
  return linkNodes(nodes.map((node) => (node.id === id ? updater(node) : node)))
}

interface SortableFlowCardProps {
  node: FlowNode
  editable: boolean
  columns: HeaderCol[]
  macroSections: FlowMacroSection[]
  recipientOptions: FlowMacroOption[]
  onChange: (node: FlowNode) => void
  onRemove: () => void
}

function SortableFlowCard({ node, editable, columns, macroSections, recipientOptions, onChange, onRemove }: SortableFlowCardProps) {
  const fixed = node.type === 'start' || node.type === 'callback'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !editable || fixed,
  })
  const structural = fixed
  const setValueColumns = columns.filter(isSetValueColumn)
  const setValueColumn = node.type === 'set_value'
    ? setValueColumns.find((column) => column.id === node.config.columnId)
    : undefined

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-xl border border-divider bg-background p-3 shadow-sm shadow-dark-900/5',
        structural && 'bg-contrast',
        isDragging && 'z-30 opacity-60 shadow-lg',
      )}
    >
      <header className="flex items-center gap-2">
        <span className={cn('flex size-7 items-center justify-center rounded-lg', structural ? 'bg-foreground text-background' : 'bg-p-purple-500/10 text-p-purple')}>
          <Icon icon={NODE_ICONS[node.type]} fontSize={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{NODE_LABELS[node.type]}</div>
          <div className="text-[11px] opacity-50">
            {node.type === 'start' ? 'Disparo manual' : node.type === 'callback' ? 'Finaliza e devolve o resultado' : 'Ação do fluxo'}
          </div>
        </div>
        {editable && !fixed && (
          <>
            <button type="button" {...attributes} {...listeners} aria-label="Reordenar ação" className="cursor-grab rounded p-1 opacity-45 hover:bg-active hover:opacity-100 active:cursor-grabbing">
              <Icon icon="lucide:grip-vertical" fontSize={17} />
            </button>
            <button type="button" onClick={onRemove} aria-label="Remover ação" className="rounded p-1 opacity-45 hover:bg-p-red-500/10 hover:text-p-red hover:opacity-100">
              <Icon icon="lucide:trash-2" fontSize={15} />
            </button>
          </>
        )}
      </header>

      {editable && node.type === 'email' && (
        <div className="mt-3 grid gap-2">
          <RecipientField
            value={node.config.to}
            onChange={(to) => onChange({ ...node, config: { ...node.config, to } })}
            options={recipientOptions}
          />
          <MacroField label="Assunto" value={node.config.subject} onChange={(subject) => onChange({ ...node, config: { ...node.config, subject } })} sections={macroSections} placeholder="Assunto do e-mail" />
          <MacroField label="Mensagem" value={node.config.body} onChange={(body) => onChange({ ...node, config: { ...node.config, body } })} sections={macroSections} multiline placeholder="Digite @ para inserir dados" />
        </div>
      )}

      {editable && node.type === 'set_value' && (
        <div className="mt-3 grid gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Propriedade
            <Select
              aria-label="Propriedade a atualizar"
              value={node.config.columnId}
              onValueChange={(columnId) => onChange({
                ...node,
                config: { ...node.config, columnId, value: '' },
              })}
              options={setValueColumns.map((column) => ({
                value: column.id,
                label: column.title || 'Sem nome',
              }))}
              placeholder="Selecione uma propriedade"
            />
          </label>
          {setValueColumn?.type === 'text' && (
            <MacroField
              label="Novo valor"
              value={node.config.value}
              onChange={(value) => onChange({ ...node, config: { ...node.config, value } })}
              sections={macroSections}
              placeholder="Valor ou @macro"
            />
          )}
          {setValueColumn?.type === 'numeric' && (
            <label className="flex flex-col gap-1 text-xs font-medium">
              Novo valor
              <input
                aria-label="Novo valor"
                type="number"
                inputMode="decimal"
                value={node.config.value}
                onChange={(event) => onChange({
                  ...node,
                  config: { ...node.config, value: event.target.value },
                })}
                className="h-9 w-full rounded border border-divider bg-background px-2.5 text-sm font-normal outline-none focus:border-p-purple focus:ring-2 focus:ring-p-purple-500/20"
                placeholder="0"
              />
            </label>
          )}
          {setValueColumn?.type === 'select' && (
            <div className="grid gap-1">
              <Select
                label="Novo valor"
                aria-label="Novo valor"
                value={node.config.value}
                onValueChange={(value) => onChange({
                  ...node,
                  config: { ...node.config, value },
                })}
                options={(setValueColumn.options ?? []).map((option) => ({
                  value: option.id,
                  label: option.label,
                }))}
                placeholder={setValueColumn.options?.length ? 'Selecione uma opção' : 'Nenhuma opção configurada'}
                disabled={!setValueColumn.options?.length}
              />
              {!setValueColumn.options?.length && (
                <span className="text-[11px] font-normal opacity-55">
                  Adicione opções à propriedade antes de usá-la no Flow.
                </span>
              )}
            </div>
          )}
          {setValueColumn?.type === 'checkbox' && (
            <Select
              label="Novo valor"
              aria-label="Novo valor"
              value={node.config.value}
              onValueChange={(value) => onChange({
                ...node,
                config: { ...node.config, value },
              })}
              options={[
                { value: 'true', label: 'Sim' },
                { value: 'false', label: 'Não' },
              ]}
              placeholder="Selecione Sim ou Não"
            />
          )}
          {!setValueColumn && node.config.columnId && (
            <div className="rounded-lg border border-divider bg-contrast px-2.5 py-2 text-[11px] opacity-70">
              Esse tipo de propriedade ainda não pode ser atualizado por um Flow.
            </div>
          )}
        </div>
      )}

      {editable && node.type === 'switch' && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MacroField label="Valor" value={node.config.left} onChange={(left) => onChange({ ...node, config: { ...node.config, left } })} sections={macroSections} placeholder="Digite @ para inserir dados" />
          <label className="flex flex-col gap-1 text-xs font-medium">
            Operador
            <Select
              aria-label="Operador da condição"
              value={node.config.operator}
              onValueChange={(operator) => onChange({ ...node, config: { ...node.config, operator: operator as FlowConditionOperator } })}
              options={CONDITION_OPTIONS}
            />
          </label>
          {!['is_empty', 'is_not_empty'].includes(node.config.operator) && (
            <div className="sm:col-span-2">
              <MacroField label="Comparar com" value={node.config.right ?? ''} onChange={(right) => onChange({ ...node, config: { ...node.config, right } })} sections={macroSections} placeholder="Valor ou @macro" />
            </div>
          )}
          <div className="sm:col-span-2 rounded-lg bg-contrast px-2.5 py-2 text-[11px] opacity-70">
            Se verdadeiro, segue para a próxima ação. Se falso, encerra no retorno.
          </div>
        </div>
      )}

      {editable && node.type === 'callback' && (
        <div className="mt-3">
          <MacroField label="Mensagem de retorno" value={node.config.message} onChange={(message) => onChange({ ...node, config: { message } })} sections={macroSections} placeholder="Flow concluído" />
        </div>
      )}
    </article>
  )
}

export interface FlowEditorDialogProps {
  open: boolean
  mode: 'configure' | 'execute'
  column: HeaderCol | null
  row?: RowData
  columns: HeaderCol[]
  onOpenChange: (open: boolean) => void
  loadMacros?: (input: { columnId: string; rowId?: string }) => Promise<FlowMacroOption[]>
  buildMacroSections?: FlowMacroSectionsBuilder
  onSave?: (columnId: string, flow: FlowDefinition) => Promise<FlowDefinition | void> | FlowDefinition | void
  onExecute?: (input: { columnId: string; rowId: string }) => Promise<FlowExecutionResult>
}

export function FlowEditorDialog({ open, mode, column, row, columns, onOpenChange, loadMacros, buildMacroSections, onSave, onExecute }: FlowEditorDialogProps) {
  const [draft, setDraft] = useState<FlowDefinition>(() => createDefaultFlowDefinition())
  const [macros, setMacros] = useState<FlowMacroOption[]>([])
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<FlowExecutionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sensors = useSortableSensors()
  const macroScope = useMemo(() => createFlowMacroScope(macros), [macros])
  const macroSections = useMemo(
    () => buildMacroSections?.(macroScope) ?? createFlowMacroSections(macroScope),
    [buildMacroSections, macroScope],
  )
  const recipientOptions = useMemo(
    () => createRecipientOptions(macroScope, columns, row),
    [columns, macroScope, row],
  )

  useEffect(() => {
    if (!open || !column) return
    setDraft(column.flow ?? createDefaultFlowDefinition())
    setResult(null)
    setError(null)
    if (!loadMacros) {
      setMacros([])
      return
    }
    let current = true
    void loadMacros({ columnId: column.id, ...(row && { rowId: row.id }) })
      .then((loaded) => { if (current) setMacros(loaded) })
      .catch(() => { if (current) setMacros([]) })
    return () => { current = false }
  }, [column, loadMacros, open, row])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setDraft((current) => {
      const from = current.nodes.findIndex((node) => node.id === active.id)
      const to = current.nodes.findIndex((node) => node.id === over.id)
      if (from <= 0 || to <= 0 || from === current.nodes.length - 1 || to === current.nodes.length - 1) return current
      return { ...current, nodes: linkNodes(arrayMove(current.nodes, from, to)) }
    })
  }

  const addAction = (type: Exclude<FlowNodeType, 'start' | 'callback'>) => {
    setDraft((current) => {
      if (type === 'switch' && current.nodes.some((node) => node.type === 'switch')) return current
      const next = [...current.nodes]
      next.splice(Math.max(1, next.length - 1), 0, createAction(type))
      return { ...current, nodes: linkNodes(next) }
    })
  }

  const save = async () => {
    if (!column || !onSave) return
    setPending(true)
    setError(null)
    try {
      const saved = await onSave(column.id, { ...draft, nodes: linkNodes(draft.nodes) })
      if (saved) setDraft(saved)
      onOpenChange(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o flow.')
    } finally {
      setPending(false)
    }
  }

  const execute = async () => {
    if (!column || !row || !onExecute) return
    setPending(true)
    setError(null)
    setResult(null)
    try {
      setResult(await onExecute({ columnId: column.id, rowId: row.id }))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível executar o flow.')
    } finally {
      setPending(false)
    }
  }

  const canEdit = mode === 'configure'
  const flowNodes = canEdit ? draft.nodes : (column?.flow?.nodes ?? draft.nodes)

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!pending) onOpenChange(nextOpen) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dark-900/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[min(94vw,720px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-divider bg-background shadow-2xl shadow-dark-900/20 focus:outline-none">
          <header className="flex shrink-0 items-start gap-3 border-b border-divider px-5 py-4">
            <span className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-p-purple-500/10 text-p-purple">
              <Icon icon="lucide:workflow" fontSize={19} />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate text-base font-semibold">{column?.title || 'Flow'}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-xs opacity-55">
                {canEdit ? 'Configure as ações. A execução e a validação final acontecem na API.' : `Executar para ${row?.cells.page_title?.value ?? 'esta página'}.`}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Fechar" disabled={pending} className="rounded-lg p-1.5 opacity-55 hover:bg-active hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-30">
                <Icon icon="lucide:x" fontSize={18} />
              </button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-contrast/45 px-5 py-4">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={flowNodes.map((node) => node.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5">
                  {flowNodes.map((node) => (
                    <SortableFlowCard
                      key={node.id}
                      node={node}
                      editable={canEdit}
                      columns={columns}
                      macroSections={macroSections}
                      recipientOptions={recipientOptions}
                      onChange={(changed) => setDraft((current) => ({ ...current, nodes: updateNode(current.nodes, node.id, () => changed) }))}
                      onRemove={() => setDraft((current) => ({ ...current, nodes: linkNodes(current.nodes.filter((candidate) => candidate.id !== node.id)) }))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium opacity-55">Adicionar ação</span>
                {(['email', 'set_value', 'switch'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={type === 'switch' && draft.nodes.some((node) => node.type === 'switch')}
                    onClick={() => addAction(type)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-background px-3 py-1.5 text-xs font-medium hover:border-p-purple/50 hover:text-p-purple disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <Icon icon={NODE_ICONS[type]} fontSize={14} />
                    {NODE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}

            {result && (
              <div className={cn('mt-4 rounded-xl border px-3 py-3 text-sm', result.status === 'succeeded' ? 'border-p-green/30 bg-p-green-500/10' : 'border-p-red/30 bg-p-red-500/10')}>
                <div className="font-semibold">{result.status === 'succeeded' ? 'Flow executado' : 'Flow interrompido'}</div>
                {(result.callback || result.error) && <div className="mt-1 opacity-70">{result.callback ?? result.error}</div>}
                <div className="mt-2 text-xs opacity-55">{result.executedNodeIds.length} etapa(s) · {result.effects.valuesUpdated} valor(es) atualizado(s) · {result.effects.emailsQueued} e-mail(s) enfileirado(s)</div>
                {flowNodes.some((node) => node.type === 'email') && (
                  <div className={cn('mt-2 rounded-lg border px-2.5 py-2 text-xs', result.effects.emailsQueued > 0 ? 'border-p-yellow/30 bg-p-yellow-500/10' : 'border-p-red/30 bg-p-red-500/10 text-p-red')}>
                    {result.effects.emailsQueued > 0
                      ? 'E-mail enfileirado. A execução terminou, mas o envio ainda não foi confirmado.'
                      : 'Nenhum e-mail foi enviado ou enfileirado nesta execução.'}
                  </div>
                )}
              </div>
            )}
            {error && <div role="alert" className="mt-4 rounded-lg bg-p-red-500/10 px-3 py-2 text-sm text-p-red">{error}</div>}
          </div>

          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-divider px-5 py-3">
            <Dialog.Close asChild>
              <Button type="button" variant="text" disabled={pending}>Cancelar</Button>
            </Dialog.Close>
            {canEdit ? (
              <Button type="button" color="purple" onClick={() => { void save() }} disabled={pending || !onSave}>
                {pending ? 'Salvando…' : 'Salvar flow'}
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => { void execute() }}
                disabled={pending || !onExecute || !row}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-p-purple bg-p-purple-500/5 px-4 text-sm font-semibold text-foreground transition-[background-color,color,box-shadow,filter] hover:bg-p-purple hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-p-purple-500/40 disabled:cursor-not-allowed disabled:opacity-55',
                  pending && 'bg-p-purple text-white shadow-lg shadow-p-purple-500/30 [filter:drop-shadow(0_0_8px_rgb(147_51_234_/_0.3))]',
                )}
              >
                <Icon icon={pending ? 'lucide:loader-circle' : 'lucide:play'} className={cn(pending && 'animate-spin')} />
                {pending ? 'Executando…' : 'Executar'}
              </button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
