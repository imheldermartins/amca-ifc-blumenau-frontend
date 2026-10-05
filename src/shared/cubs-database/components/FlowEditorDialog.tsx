import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, UIEvent } from 'react'
import { createPortal } from 'react-dom'
import * as Dialog from '@radix-ui/react-dialog'
import {
  DragOverlay,
  DndContext,
  closestCenter,
  pointerWithin,
  useDndContext,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Icon } from '@iconify/react'
import { Button, DatePicker, DragPlaceholder, IconPicker, TextField, dragPlaceholderStyle, Select, cn } from 'cubs-components'

import type {
  ColumnDataType,
  ColumnConfigPatch,
  CatalogIcon,
  FlowConditionOperator,
  FlowDefinition,
  FlowDefinitionV2,
  FlowExecutionResult,
  FlowMacroOption,
  FlowMacroScope,
  FlowMacroSection,
  FlowMacroSectionsBuilder,
  FlowNodeV2,
  FlowNodeType,
  FlowStepV2,
  HeaderCol,
  RowData,
} from '../types'
import { createDefaultFlowDefinition, toFlowDefinitionV2 } from '../flowDefinition'
import { moveFlowStep } from '../flowTree'
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

interface FlowDroppableData {
  kind: 'flow-step' | 'flow-branch'
  path: string
}

function flowDroppableData(data: unknown): FlowDroppableData | null {
  if (!data || typeof data !== 'object') return null
  const candidate = data as Partial<FlowDroppableData>
  if ((candidate.kind !== 'flow-step' && candidate.kind !== 'flow-branch') || typeof candidate.path !== 'string') return null
  return candidate as FlowDroppableData
}

/**
 * Cards e ramos são droppables simultaneamente. O `closestCenter` puro tende a
 * escolher o container grande do ramo (ou o card-pai de uma condição) em vez
 * do card sob o ponteiro. Priorizamos a menor superfície efetivamente apontada
 * e só usamos a proximidade entre cards da mesma sequência nos espaços vazios.
 */
const flowCollisionDetection: CollisionDetection = (args) => {
  const candidates = args.droppableContainers.filter((container) => container.id !== args.active.id)
  const byId = new Map(candidates.map((container) => [container.id, container]))
  const pointerCollisions = pointerWithin({ ...args, droppableContainers: candidates })
  const pointed = pointerCollisions
    .map((collision) => ({ collision, container: byId.get(collision.id) }))
    .filter((entry) => flowDroppableData(entry.container?.data.current))
    .sort((left, right) => {
      const leftRect = left.container?.rect.current
      const rightRect = right.container?.rect.current
      const leftArea = leftRect ? leftRect.width * leftRect.height : Number.POSITIVE_INFINITY
      const rightArea = rightRect ? rightRect.width * rightRect.height : Number.POSITIVE_INFINITY
      return leftArea - rightArea
    })

  const directHit = pointed[0]
  const directData = flowDroppableData(directHit?.container?.data.current)
  if (directHit && directData?.kind === 'flow-step') return [directHit.collision]

  if (directHit && directData?.kind === 'flow-branch') {
    const sequenceCards = candidates.filter((container) => {
      const data = flowDroppableData(container.data.current)
      return data?.kind === 'flow-step' && data.path === directData.path
    })
    if (sequenceCards.length === 0) return [directHit.collision]

    const lastBottom = Math.max(...sequenceCards.map((container) => container.rect.current?.bottom ?? Number.NEGATIVE_INFINITY))
    if (args.pointerCoordinates && args.pointerCoordinates.y >= lastBottom) return [directHit.collision]

    const cardCollisions = closestCenter({ ...args, droppableContainers: sequenceCards })
    return cardCollisions.length > 0 ? cardCollisions : [directHit.collision]
  }

  const cardCandidates = candidates.filter((container) => flowDroppableData(container.data.current)?.kind === 'flow-step')
  const cardCollisions = closestCenter({ ...args, droppableContainers: cardCandidates })
  return cardCollisions.length > 0
    ? cardCollisions
    : closestCenter({ ...args, droppableContainers: candidates })
}

function eventCoordinates(event: Event | null): { x: number; y: number } | null {
  if (!event) return null
  if ('clientX' in event && 'clientY' in event) {
    const pointer = event as Event & { clientX: number; clientY: number }
    return { x: pointer.clientX, y: pointer.clientY }
  }
  if ('touches' in event) {
    const touch = (event as Event & { touches: ArrayLike<{ clientX: number; clientY: number }> }).touches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }
  return null
}

/** Mantém o preview compacto centralizado sob mouse/toque, não no card grande. */
const centerFlowOverlayOnPointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  const coordinates = eventCoordinates(activatorEvent)
  if (!coordinates || !draggingNodeRect) return transform
  return {
    ...transform,
    x: transform.x + coordinates.x - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + coordinates.y - draggingNodeRect.top - draggingNodeRect.height / 2,
  }
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

function createAction(type: Exclude<FlowNodeType, 'start' | 'callback'>): FlowStepV2 {
  const id = nodeId()
  if (type === 'email') {
    return { id, type, config: { to: '', subject: '', body: '' } }
  }
  if (type === 'set_value') {
    return { id, type, config: { columnId: '', value: '' } }
  }
  return {
    id,
    type,
    config: {
      columnId: '',
      operator: 'equals',
      value: '',
      whenTrue: [],
      whenFalse: [],
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

const EMPTY_OPERATORS = new Set<FlowConditionOperator>(['is_empty', 'is_not_empty'])

function conditionColumn(columnId: string, columns: readonly HeaderCol[]): HeaderCol | undefined {
  if (columnId === 'page_title') {
    return columns.find((column) => column.key === 'title' || column.id === 'page_title')
      ?? { id: 'page_title', key: 'title', title: 'Título da página', type: 'text' }
  }
  return columns.find((column) => column.id === columnId && column.type !== 'flow')
}

function operatorsFor(type: ColumnDataType | undefined) {
  const allowed = type === 'numeric'
    ? ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty']
    : type === 'select' || type === 'date'
      ? ['equals', 'not_equals', 'is_empty', 'is_not_empty']
      : type === 'checkbox'
        ? ['equals', 'not_equals']
        : ['equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty']
  return CONDITION_OPTIONS.filter((option) => allowed.includes(option.value))
}

function conditionError(step: Extract<FlowStepV2, { type: 'switch' }>, columns: readonly HeaderCol[]): string | null {
  const column = conditionColumn(step.config.columnId, columns)
  if (!column) return 'A propriedade usada nesta condição não existe mais.'
  if (!operatorsFor(column.type).some((option) => option.value === step.config.operator)) {
    return 'O operador não é compatível com esta propriedade.'
  }
  if (EMPTY_OPERATORS.has(step.config.operator)) return null
  if (column.type === 'select' && !column.options?.some((option) => option.id === step.config.value)) {
    return 'A opção usada nesta condição não existe mais.'
  }
  if (column.type === 'numeric' && (typeof step.config.value !== 'number' || !Number.isFinite(step.config.value))) {
    return 'Informe um valor numérico válido.'
  }
  if (column.type === 'checkbox' && typeof step.config.value !== 'boolean') return 'Escolha Sim ou Não.'
  if (column.type === 'date' && typeof step.config.value !== 'string') return 'Escolha uma data válida.'
  if ((!column.type || column.type === 'text') && typeof step.config.value !== 'string') return 'Informe um texto para comparar.'
  return null
}

function mapStep(steps: FlowStepV2[], id: string, update: (step: FlowStepV2) => FlowStepV2): FlowStepV2[] {
  return steps.map((step) => {
    if (step.id === id) return update(step)
    if (step.type !== 'switch') return step
    return {
      ...step,
      config: {
        ...step.config,
        whenTrue: mapStep(step.config.whenTrue, id, update),
        whenFalse: mapStep(step.config.whenFalse, id, update),
      },
    }
  })
}

function removeStep(steps: FlowStepV2[], id: string): { steps: FlowStepV2[]; removed?: FlowStepV2 } {
  const direct = steps.find((step) => step.id === id)
  if (direct) return { steps: steps.filter((step) => step.id !== id), removed: direct }
  for (const step of steps) {
    if (step.type !== 'switch') continue
    const fromTrue = removeStep(step.config.whenTrue, id)
    if (fromTrue.removed) {
      return { steps: mapStep(steps, step.id, () => ({ ...step, config: { ...step.config, whenTrue: fromTrue.steps } })), removed: fromTrue.removed }
    }
    const fromFalse = removeStep(step.config.whenFalse, id)
    if (fromFalse.removed) {
      return { steps: mapStep(steps, step.id, () => ({ ...step, config: { ...step.config, whenFalse: fromFalse.steps } })), removed: fromFalse.removed }
    }
  }
  return { steps }
}

function replaceSequence(steps: FlowStepV2[], path: string, replacement: FlowStepV2[]): FlowStepV2[] {
  if (path === 'root') return replacement
  const separator = path.lastIndexOf(':')
  const switchId = path.slice(0, separator)
  const branch = path.slice(separator + 1)
  return mapStep(steps, switchId, (candidate) => {
    if (candidate.type !== 'switch') return candidate
    return {
      ...candidate,
      config: {
        ...candidate.config,
        ...(branch === 'true' ? { whenTrue: replacement } : { whenFalse: replacement }),
      },
    }
  })
}

function readSequence(steps: readonly FlowStepV2[], path: string): FlowStepV2[] {
  if (path === 'root') return [...steps]
  const separator = path.lastIndexOf(':')
  const switchId = path.slice(0, separator)
  const branch = path.slice(separator + 1)
  let found: FlowStepV2[] = []
  const visit = (items: readonly FlowStepV2[]) => {
    for (const item of items) {
      if (item.type !== 'switch') continue
      if (item.id === switchId) {
        found = branch === 'true' ? item.config.whenTrue : item.config.whenFalse
        return true
      }
      if (visit(item.config.whenTrue) || visit(item.config.whenFalse)) return true
    }
    return false
  }
  visit(steps)
  return [...found]
}

function countSteps(steps: readonly FlowStepV2[]): number {
  return steps.reduce((count, step) => count + 1 + (step.type === 'switch'
    ? countSteps(step.config.whenTrue) + countSteps(step.config.whenFalse)
    : 0), 0)
}

function findStep(steps: readonly FlowStepV2[], id: string | null): FlowStepV2 | null {
  if (!id) return null
  for (const step of steps) {
    if (step.id === id) return step
    if (step.type !== 'switch') continue
    const nested = findStep(step.config.whenTrue, id) ?? findStep(step.config.whenFalse, id)
    if (nested) return nested
  }
  return null
}

function hasEmail(steps: readonly FlowStepV2[]): boolean {
  return steps.some((step) => step.type === 'email' || (step.type === 'switch'
    && (hasEmail(step.config.whenTrue) || hasEmail(step.config.whenFalse))))
}

function hasInvalidCondition(steps: readonly FlowStepV2[], columns: readonly HeaderCol[]): boolean {
  return steps.some((step) => step.type === 'switch' && (
    Boolean(conditionError(step, columns))
    || hasInvalidCondition(step.config.whenTrue, columns)
    || hasInvalidCondition(step.config.whenFalse, columns)
  ))
}

interface ActionButtonsProps {
  onAdd: (type: Exclude<FlowNodeType, 'start' | 'callback'>) => void
}

function ActionButtons({ onAdd }: ActionButtonsProps) {
  return <div className="flex flex-wrap items-center gap-2">
    <span className="mr-1 text-xs font-medium opacity-55">Adicionar ação</span>
    {(['email', 'set_value', 'switch'] as const).map((type) => (
      <button key={type} type="button" onClick={() => onAdd(type)} className="inline-flex items-center gap-1.5 rounded-full border border-divider bg-background px-3 py-1.5 text-xs font-medium hover:border-p-purple/50 hover:text-p-purple">
        <Icon icon={NODE_ICONS[type]} fontSize={14} />
        {NODE_LABELS[type]}
      </button>
    ))}
  </div>
}

interface BranchSequenceProps {
  label?: string
  path: string
  steps: FlowStepV2[]
  editable: boolean
  depth: number
  columns: HeaderCol[]
  macroSections: FlowMacroSection[]
  recipientOptions: FlowMacroOption[]
  onChange: (step: FlowStepV2) => void
  onRemove: (id: string) => void
  onAdd: (path: string, type: Exclude<FlowNodeType, 'start' | 'callback'>) => void
}

function BranchSequence({ label, path, steps, editable, depth, columns, macroSections, recipientOptions, onChange, onRemove, onAdd }: BranchSequenceProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { active, over, activeNodeRect } = useDndContext()
  const sourcePath = (active?.data.current as FlowDroppableData | undefined)?.path
  const targetId = sourcePath !== path && !path.startsWith(`${active?.id}:`) ? over?.id : null
  const placeholder = <div className="relative" style={{ ...dragPlaceholderStyle(activeNodeRect), minWidth: 0, maxWidth: '100%' }}><DragPlaceholder className="rounded-xl" /></div>
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${path}`,
    disabled: !editable,
    data: { kind: 'flow-branch', path } satisfies FlowDroppableData,
  })
  return <section className={cn(label && 'border-l-2 border-p-purple-500/25', label && depth <= 3 && 'pl-3')}>
    {label && <button type="button" onClick={() => setCollapsed((value) => !value)} className="mb-2 flex w-full items-center gap-2 text-left text-xs font-semibold">
      <Icon icon={collapsed ? 'lucide:chevron-right' : 'lucide:chevron-down'} />
      <span>{label}</span>
      <span className="font-normal opacity-45">{countSteps(steps)} ação(ões)</span>
    </button>}
    {!collapsed && <div ref={setNodeRef} className={cn('grid min-h-12 gap-2 rounded-lg', isOver && 'bg-p-purple-500/5 ring-1 ring-p-purple-500/25')}>
      <SortableContext items={steps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
        {steps.map((step) => <Fragment key={step.id}>
          {targetId === step.id && placeholder}
          <SortableFlowCard
            node={step}
            path={path}
            editable={editable}
            depth={depth}
            columns={columns}
            macroSections={macroSections}
            recipientOptions={recipientOptions}
            onChange={onChange}
            onRemove={() => onRemove(step.id)}
            onAdd={onAdd}
          />
        </Fragment>)}
      </SortableContext>
      {isOver && targetId === `drop:${path}` && placeholder}
      {editable && <div className="pt-1"><ActionButtons onAdd={(type) => onAdd(path, type)} /></div>}
    </div>}
  </section>
}

interface SortableFlowCardProps {
  node: FlowStepV2
  path: string
  editable: boolean
  depth: number
  columns: HeaderCol[]
  macroSections: FlowMacroSection[]
  recipientOptions: FlowMacroOption[]
  onChange: (node: FlowStepV2) => void
  onRemove: () => void
  onAdd: (path: string, type: Exclude<FlowNodeType, 'start' | 'callback'>) => void
}

function SortableFlowCard({ node, path, editable, depth, columns, macroSections, recipientOptions, onChange, onRemove, onAdd }: SortableFlowCardProps) {
  const [confirmingRemoval, setConfirmingRemoval] = useState(false)
  const { activeNodeRect } = useDndContext()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    disabled: !editable,
    data: { kind: 'flow-step', path } satisfies FlowDroppableData,
  })
  const setValueColumns = columns.filter(isSetValueColumn)
  const setValueColumn = node.type === 'set_value' ? setValueColumns.find((column) => column.id === node.config.columnId) : undefined
  const selectedConditionColumn = node.type === 'switch' ? conditionColumn(node.config.columnId, columns) : undefined
  const invalid = node.type === 'switch' ? conditionError(node, columns) : null
  const conditionColumns = [
    ...(columns.some((column) => column.key === 'title' || column.id === 'page_title') ? [] : [{ id: 'page_title', key: 'title' as const, title: 'Título da página', type: 'text' as const }]),
    ...columns.filter((column) => column.type !== 'flow'),
  ]

  return <article
    ref={setNodeRef}
    {...attributes}
    {...listeners}
    role="group"
    aria-label={`${NODE_LABELS[node.type]} arrastável`}
    data-flow-sortable-card={node.id}
    style={{
      ...(isDragging ? dragPlaceholderStyle(activeNodeRect) : undefined),
      transform: CSS.Transform.toString(transform),
      transition,
    }}
    onPointerDown={(event) => {
      event.stopPropagation()
      const target = event.target as HTMLElement
      if (target.closest('button,input,textarea,select,[role="combobox"],[contenteditable="true"]')) return
      listeners?.onPointerDown?.(event)
    }}
    onKeyDown={(event) => {
      // Durante o drag, Escape e setas pertencem ao KeyboardSensor no document.
      if (isDragging) return
      event.stopPropagation()
      if (event.target === event.currentTarget) listeners?.onKeyDown?.(event)
    }}
    className={cn(
      'rounded-xl border bg-background p-3 shadow-sm shadow-dark-900/5 outline-none transition-[border-color,box-shadow,opacity]',
      editable && 'cursor-grab touch-pan-y active:cursor-grabbing focus-visible:border-p-purple focus-visible:ring-2 focus-visible:ring-p-purple-500/25',
      invalid ? 'border-p-red/50' : 'border-divider',
      isDragging && 'relative z-30 [&>*:not([data-drag-placeholder])]:invisible',
    )}
  >
    {isDragging && <DragPlaceholder className="rounded-xl" />}
    <header className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-p-purple-500/10 text-p-purple"><Icon icon={NODE_ICONS[node.type]} fontSize={15} /></span>
      <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{NODE_LABELS[node.type]}</div><div className="text-[11px] opacity-50">{node.type === 'switch' ? 'Ramifica e volta à sequência comum' : 'Ação do fluxo'}</div></div>
      {editable && <>
        <button type="button" onClick={() => node.type === 'switch' && (node.config.whenTrue.length || node.config.whenFalse.length) ? setConfirmingRemoval(true) : onRemove()} aria-label="Remover ação" className="rounded p-1 opacity-45 hover:bg-p-red-500/10 hover:text-p-red hover:opacity-100"><Icon icon="lucide:trash-2" fontSize={15} /></button>
      </>}
    </header>

    {confirmingRemoval && <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-p-red/30 bg-p-red-500/10 px-3 py-2 text-xs"><span>Remover esta condição e toda a subárvore?</span><span className="flex gap-1"><Button type="button" variant="text" onClick={() => setConfirmingRemoval(false)}>Cancelar</Button><Button type="button" color="red" onClick={onRemove}>Confirmar remoção</Button></span></div>}

    {editable && node.type === 'email' && <div className="mt-3 grid gap-2">
      <RecipientField value={node.config.to} onChange={(to) => onChange({ ...node, config: { ...node.config, to } })} options={recipientOptions} />
      <MacroField label="Assunto" value={node.config.subject} onChange={(subject) => onChange({ ...node, config: { ...node.config, subject } })} sections={macroSections} placeholder="Assunto do e-mail" />
      <MacroField label="Mensagem" value={node.config.body} onChange={(body) => onChange({ ...node, config: { ...node.config, body } })} sections={macroSections} multiline placeholder="Digite @ para inserir dados" />
    </div>}

    {editable && node.type === 'set_value' && <div className="mt-3 grid gap-2">
      <Select label="Propriedade" aria-label="Propriedade a atualizar" value={node.config.columnId} onValueChange={(columnId) => onChange({ ...node, config: { columnId, value: '' } })} options={setValueColumns.map((column) => ({ value: column.id, label: column.title || 'Sem nome' }))} placeholder="Selecione uma propriedade" />
      {setValueColumn?.type === 'text' && <MacroField label="Novo valor" value={String(node.config.value ?? '')} onChange={(value) => onChange({ ...node, config: { ...node.config, value } })} sections={macroSections} placeholder="Valor ou @macro" />}
      {setValueColumn?.type === 'numeric' && <label className="flex flex-col gap-1 text-xs font-medium">Novo valor<input aria-label="Novo valor" type="number" inputMode="decimal" value={String(node.config.value ?? '')} onChange={(event) => onChange({ ...node, config: { ...node.config, value: event.target.value } })} className="h-9 w-full rounded border border-divider bg-background px-2.5 text-sm font-normal outline-none focus:border-p-purple" placeholder="0" /></label>}
      {setValueColumn?.type === 'select' && <Select label="Novo valor" aria-label="Novo valor" value={String(node.config.value ?? '')} onValueChange={(value) => onChange({ ...node, config: { ...node.config, value } })} options={(setValueColumn.options ?? []).map((option) => ({ value: option.id, label: option.label }))} placeholder="Selecione uma opção" disabled={!setValueColumn.options?.length} />}
      {setValueColumn?.type === 'checkbox' && <Select label="Novo valor" aria-label="Novo valor" value={String(node.config.value ?? '')} onValueChange={(value) => onChange({ ...node, config: { ...node.config, value } })} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} placeholder="Selecione Sim ou Não" />}
      {!setValueColumn && node.config.columnId && <div className="rounded-lg border border-divider bg-contrast px-2.5 py-2 text-[11px] opacity-70">Essa propriedade não existe mais ou não pode ser atualizada.</div>}
    </div>}

    {node.type === 'switch' && <div className="mt-3 grid gap-3">
      {editable && <div className="grid gap-2 sm:grid-cols-2">
        <Select label="Propriedade" aria-label="Propriedade da condição" value={node.config.columnId} onValueChange={(columnId) => {
          const nextColumn = conditionColumn(columnId, columns)
          onChange({ ...node, config: { ...node.config, columnId, operator: 'equals', value: nextColumn?.type === 'checkbox' ? true : nextColumn?.type === 'numeric' ? 0 : '' } })
        }} options={conditionColumns.map((column) => ({ value: column.key === 'title' ? 'page_title' : column.id, label: column.title || 'Sem nome' }))} placeholder="Selecione uma propriedade" />
        <Select label="Operador" aria-label="Operador da condição" value={node.config.operator} onValueChange={(operator) => onChange({ ...node, config: { ...node.config, operator: operator as FlowConditionOperator, ...(EMPTY_OPERATORS.has(operator as FlowConditionOperator) ? { value: undefined } : {}) } })} options={operatorsFor(selectedConditionColumn?.type)} />
        {!EMPTY_OPERATORS.has(node.config.operator) && <div className="sm:col-span-2">
          {selectedConditionColumn?.type === 'select' ? <Select label="Comparar com" aria-label="Comparar com" value={String(node.config.value ?? '')} onValueChange={(value) => onChange({ ...node, config: { ...node.config, value } })} options={(selectedConditionColumn.options ?? []).map((option) => ({ value: option.id, label: option.label }))} placeholder="Selecione uma opção" />
            : selectedConditionColumn?.type === 'checkbox' ? <Select label="Comparar com" aria-label="Comparar com" value={String(node.config.value ?? '')} onValueChange={(value) => onChange({ ...node, config: { ...node.config, value: value === 'true' } })} options={[{ value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }]} />
              : selectedConditionColumn?.type === 'date' ? <label className="grid gap-1 text-xs font-medium">Comparar com<DatePicker aria-label="Comparar com" value={typeof node.config.value === 'string' ? node.config.value : null} onValueChange={(value) => onChange({ ...node, config: { ...node.config, value: value ?? '' } })} selectionMode="optional-range" size="sm" /></label>
                : <label className="grid gap-1 text-xs font-medium">Comparar com<input aria-label="Comparar com" type={selectedConditionColumn?.type === 'numeric' ? 'number' : 'text'} value={String(node.config.value ?? '')} onChange={(event) => onChange({ ...node, config: { ...node.config, value: selectedConditionColumn?.type === 'numeric' ? (event.target.value === '' ? Number.NaN : Number(event.target.value)) : event.target.value } })} className="h-9 rounded border border-divider bg-background px-2.5 text-sm font-normal outline-none focus:border-p-purple" /></label>}
        </div>}
      </div>}
      {invalid && <div role="alert" className="rounded-lg bg-p-red-500/10 px-3 py-2 text-xs text-p-red">{invalid}</div>}
      <BranchSequence label="Se sim" path={`${node.id}:true`} steps={node.config.whenTrue} editable={editable} depth={depth + 1} columns={columns} macroSections={macroSections} recipientOptions={recipientOptions} onChange={onChange} onRemove={onRemove} onAdd={onAdd} />
      <BranchSequence label="Se não" path={`${node.id}:false`} steps={node.config.whenFalse} editable={editable} depth={depth + 1} columns={columns} macroSections={macroSections} recipientOptions={recipientOptions} onChange={onChange} onRemove={onRemove} onAdd={onAdd} />
      <div className="flex items-center gap-2 rounded-lg bg-contrast px-2.5 py-2 text-[11px] font-medium"><Icon icon="lucide:merge" className="text-p-purple" />Depois da condição</div>
    </div>}
  </article>
}

function FlowCardDragOverlay({ node }: { node: FlowStepV2 }) {
  return <article
    data-flow-drag-overlay
    aria-hidden="true"
    className="pointer-events-none w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-p-purple-500/55 bg-background p-3 shadow-xl shadow-p-purple-500/15 ring-1 ring-p-purple-500/25"
  >
    <header className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-lg bg-p-purple-500/15 text-p-purple">
        <Icon icon={NODE_ICONS[node.type]} fontSize={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{NODE_LABELS[node.type]}</div>
        <div className="text-[11px] opacity-50">
          {node.type === 'switch'
            ? `${countSteps(node.config.whenTrue) + countSteps(node.config.whenFalse)} ação(ões) nos ramos`
            : 'Ação do fluxo'}
        </div>
      </div>
    </header>
  </article>
}

function StructuralCard({ node, editable, macroSections, onChange }: { node: Extract<FlowNodeV2, { type: 'start' | 'callback' }>; editable: boolean; macroSections: FlowMacroSection[]; onChange: (node: FlowNodeV2) => void }) {
  return <article className="rounded-xl border border-divider bg-contrast p-3"><header className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background"><Icon icon={NODE_ICONS[node.type]} fontSize={15} /></span><div><div className="text-sm font-semibold">{NODE_LABELS[node.type]}</div><div className="text-[11px] opacity-50">{node.type === 'start' ? 'Disparo manual' : 'Finaliza e devolve o resultado'}</div></div></header>{editable && node.type === 'callback' && <div className="mt-3"><MacroField label="Mensagem de retorno" value={node.config.message ?? ''} onChange={(message) => onChange({ ...node, config: { message } })} sections={macroSections} placeholder="Flow concluído" /></div>}</article>
}

export interface FlowEditorDialogProps {
  readOnly?: boolean
  onButtonChange?: (columnId: string, patch: ColumnConfigPatch) => void
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

export function FlowEditorDialog({ open, mode, column, row, columns, onOpenChange, loadMacros, buildMacroSections, onSave, onExecute, onButtonChange, readOnly = false }: FlowEditorDialogProps) {
  const [buttonLabel, setButtonLabel] = useState('')
  const [draft, setDraft] = useState<FlowDefinitionV2>(() => createDefaultFlowDefinition())
  const [macros, setMacros] = useState<FlowMacroOption[]>([])
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<FlowExecutionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const draftSourceRef = useRef<string | null>(null)
  const buttonColumnId = column?.id
  const savedButtonLabel = column?.flowButton?.label ?? ''
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
    if (!open || !column) {
      draftSourceRef.current = null
      return
    }
    const source = JSON.stringify([mode, column.id, row?.id, column.flow])
    if (draftSourceRef.current === source) return
    draftSourceRef.current = source
    setDraft(toFlowDefinitionV2(column.flow, columns))
    setResult(null)
    setError(null)
  }, [column, columns, mode, open, row?.id])

  useEffect(() => {
    if (!open || !buttonColumnId) return
    setButtonLabel(savedButtonLabel)
  }, [buttonColumnId, savedButtonLabel, open])

  useEffect(() => {
    if (!open || !column) return
    if (!loadMacros) {
      setMacros([])
      return
    }
    let current = true
    void loadMacros({ columnId: column.id, ...(row && { rowId: row.id }) })
      .then((loaded) => { if (current) setMacros(loaded) })
      .catch(() => { if (current) setMacros([]) })
    return () => { current = false }
  }, [column, columns, loadMacros, open, row])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragId(null)
    if (!over || active.id === over.id) return
    setDraft((current) => {
      const steps = current.nodes.slice(1, -1) as FlowStepV2[]
      const activeId = String(active.id)
      const overId = String(over.id)
      const moved = moveFlowStep(steps, activeId, overId)
      return { ...current, nodes: [current.nodes[0]!, ...moved, current.nodes.at(-1)!] }
    })
  }

  const addAction = (path: string, type: Exclude<FlowNodeType, 'start' | 'callback'>) => {
    setDraft((current) => {
      const steps = current.nodes.slice(1, -1) as FlowStepV2[]
      if (countSteps(steps) + 3 > 100) return current
      const sequence = readSequence(steps, path)
      sequence.push(createAction(type))
      const next = replaceSequence(steps, path, sequence)
      return { ...current, nodes: [current.nodes[0]!, ...next, current.nodes.at(-1)!] }
    })
  }

  const changeStep = (changed: FlowStepV2) => setDraft((current) => {
    const steps = current.nodes.slice(1, -1) as FlowStepV2[]
    return { ...current, nodes: [current.nodes[0]!, ...mapStep(steps, changed.id, () => changed), current.nodes.at(-1)!] }
  })

  const removeAction = (id: string) => setDraft((current) => {
    const removed = removeStep(current.nodes.slice(1, -1) as FlowStepV2[], id)
    return { ...current, nodes: [current.nodes[0]!, ...removed.steps, current.nodes.at(-1)!] }
  })

  const save = async () => {
    if (!column || !onSave) return
    setPending(true)
    setError(null)
    try {
      const saved = await onSave(column.id, draft)
      if (saved) setDraft(toFlowDefinitionV2(saved, columns))
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

  const canEdit = mode === 'configure' && !readOnly
  const visibleFlow = canEdit ? draft : toFlowDefinitionV2(column?.flow, columns)
  const flowSteps = visibleFlow.nodes.slice(1, -1) as FlowStepV2[]
  const startNode = visibleFlow.nodes[0] as Extract<FlowNodeV2, { type: 'start' }>
  const callbackNode = visibleFlow.nodes.at(-1) as Extract<FlowNodeV2, { type: 'callback' }>
  const invalidConditions = hasInvalidCondition(draft.nodes.slice(1, -1) as FlowStepV2[], columns)
  const activeDragStep = findStep(flowSteps, activeDragId)

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!pending) onOpenChange(nextOpen) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dark-900/35 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          onEscapeKeyDown={(event) => { if (activeDragId) event.preventDefault() }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[min(94vw,720px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-divider bg-background shadow-2xl shadow-dark-900/20 focus:outline-none"
        >
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
            {canEdit && onButtonChange && column ? <div className="mb-4 grid gap-3 rounded-xl border border-divider bg-background p-3">
              <TextField label="Texto do botão Flow" placeholder="Vazio: somente ícone" value={buttonLabel} maxLength={80} disabled={pending}
                onChange={(event) => setButtonLabel(event.target.value)}
                onBlur={() => {
                  const label = buttonLabel.trim() || null
                  if (label !== (column.flowButton?.label ?? null)) onButtonChange(column.id, { flowButton: { label, icon: column.flowButton?.icon || 'lucide:play' } })
                }} />
              <IconPicker label="Ícone do botão Flow" value={(column.flowButton?.icon || 'lucide:play') as CatalogIcon} disabled={pending}
                labels={{ choose: 'Escolher ícone', search: 'Buscar ícone', empty: 'Nenhum ícone encontrado', loading: 'Carregando ícones…', loadMore: 'Carregar mais' }}
                onValueChange={(icon) => onButtonChange(column.id, { flowButton: { label: buttonLabel.trim() || null, icon: icon || 'lucide:play' } })} />
            </div> : null}
            <DndContext
              sensors={sensors}
              collisionDetection={flowCollisionDetection}
              onDragStart={({ active }) => setActiveDragId(String(active.id))}
              onDragCancel={() => setActiveDragId(null)}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-2.5">
                <StructuralCard node={startNode} editable={false} macroSections={macroSections} onChange={() => undefined} />
                <BranchSequence path="root" steps={flowSteps} editable={canEdit} depth={0} columns={columns} macroSections={macroSections} recipientOptions={recipientOptions} onChange={changeStep} onRemove={removeAction} onAdd={addAction} />
                <StructuralCard node={callbackNode} editable={canEdit} macroSections={macroSections} onChange={(changed) => setDraft((current) => ({ ...current, nodes: [...current.nodes.slice(0, -1), changed] }))} />
              </div>
              {typeof document !== 'undefined'
                ? createPortal(
                    <DragOverlay
                      adjustScale={false}
                      dropAnimation={null}
                      modifiers={[centerFlowOverlayOnPointer]}
                    >
                      {activeDragStep && <FlowCardDragOverlay node={activeDragStep} />}
                    </DragOverlay>,
                    document.body,
                  )
                : null}
            </DndContext>

            {result && (
              <div className={cn('mt-4 rounded-xl border px-3 py-3 text-sm', result.status === 'succeeded' ? 'border-p-green/30 bg-p-green-500/10' : 'border-p-red/30 bg-p-red-500/10')}>
                <div className="font-semibold">{result.status === 'succeeded' ? 'Flow executado' : 'Flow interrompido'}</div>
                {(result.callback || result.error) && <div className="mt-1 opacity-70">{result.callback ?? result.error}</div>}
                <div className="mt-2 text-xs opacity-55">{result.executedNodeIds.length} etapa(s) · {result.effects.valuesUpdated} valor(es) atualizado(s) · {result.effects.emailsQueued} e-mail(s) enfileirado(s)</div>
                {hasEmail(flowSteps) && (
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
              <Button type="button" color="purple" onClick={() => { void save() }} disabled={pending || !onSave || invalidConditions}>
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
