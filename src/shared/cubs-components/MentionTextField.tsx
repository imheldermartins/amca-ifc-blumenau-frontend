import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type FocusEventHandler, type ChangeEventHandler, type KeyboardEventHandler, type ReactEventHandler } from 'react'
import { createPortal } from 'react-dom'
import { TextField, type TextFieldProps } from './TextField'
import { cn } from './lib/utils'
import { applyMask } from './lib/masks'
import { displayMentionText, editMentionProjection, projectMentions, rawMentionOffset, visibleMentionOffset } from './lib/mentionPresentation'

export interface MentionInputOption { id: string; label: string; value: string; section: string; search?: string }
export interface MentionInputConfig {
  options: MentionInputOption[]
  resolve: (text: string) => string
  token: (id: string) => string
  label: string
  empty: string
  unavailable?: string
  track?: (text: string) => void
}
type MentionElement = HTMLInputElement | HTMLTextAreaElement
export interface MentionTextFieldProps extends Omit<TextFieldProps, 'name' | 'value' | 'onChange' | 'onFocus' | 'onBlur' | 'onKeyDown'> {
  value: string
  onValueChange: (value: string) => void
  mentions?: MentionInputConfig
  multiline?: boolean
  onFocus?: FocusEventHandler<MentionElement>
  onBlur?: FocusEventHandler<MentionElement>
  onKeyDown?: KeyboardEventHandler<MentionElement>
  /** Keep an existing native input's exact markup and styling. */
  renderInput?: (control: MentionInputControl) => ReactNode
}
type MentionInputControl = Pick<ComponentProps<'input'>, 'value' | 'role' | 'aria-autocomplete' | 'aria-expanded' | 'aria-controls' | 'aria-activedescendant'> & {
  ref: (node: MentionElement | null) => void
  onFocus: FocusEventHandler<MentionElement>; onBlur: FocusEventHandler<MentionElement>
  onChange: ChangeEventHandler<MentionElement>; onSelect: ReactEventHandler<MentionElement>; onKeyDown: KeyboardEventHandler<MentionElement>
}

/** Native input with a readable projection; editing preserves untouched persisted references. */
export function MentionTextField({ value, onValueChange, mentions, onFocus, onBlur, onKeyDown, className, renderInput, mask, multiline = false, ...props }: MentionTextFieldProps) {
  const input = useRef<MentionElement>(null)
  const selection = useRef<{ start: number; end: number } | null>(null)
  const pendingCursor = useRef<number | null>(null)
  const projection = projectMentions(value, mentions?.resolve, mentions?.unavailable)
  const [focused, setFocused] = useState(false)
  const [trigger, setTrigger] = useState<{ from: number; to: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  const listId = useId()
  const track = mentions?.track
  useEffect(() => { track?.(value) }, [track, value])
  const candidates = mentions?.options.filter((option) => `${option.label} ${option.search ?? ''}`.toLocaleLowerCase().includes(trigger?.query.toLocaleLowerCase() ?? '')) ?? []
  const detect = (text: string, cursor: number | null) => {
    const prefix = text.slice(0, cursor ?? text.length)
    const match = /(?:^|\s)@([^@{}\s]*)$/.exec(prefix)
    setActive(0)
    setTrigger(match ? { from: prefix.lastIndexOf('@'), to: prefix.length, query: match[1]! } : null)
  }
  const choose = (option: MentionInputOption) => {
    if (!trigger || !mentions) return
    const inserted = mentions.token(option.id)
    const start = rawMentionOffset(projection, trigger.from)
    const end = rawMentionOffset(projection, trigger.to, true)
    const next = value.slice(0, start) + inserted + value.slice(end)
    pendingCursor.current = start + inserted.length
    onValueChange(next); setTrigger(null)
    requestAnimationFrame(() => input.current?.focus())
  }
  const open = focused && Boolean(trigger && mentions)
  useEffect(() => { if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' }) }, [active, open, listId])
  const [position, setPosition] = useState({ left: 8, top: 8 })
  useLayoutEffect(() => {
    if (pendingCursor.current !== null && input.current) {
      const cursor = visibleMentionOffset(projection, pendingCursor.current)
      input.current.setSelectionRange(cursor, cursor)
      selection.current = { start: cursor, end: cursor }
      pendingCursor.current = null
    }
  })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = input.current?.getBoundingClientRect()
      if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)), top: Math.max(8, rect.bottom + 300 < window.innerHeight ? rect.bottom + 4 : rect.top - 296) })
    }
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])
  useLayoutEffect(() => {
    if (!multiline || !input.current) return
    input.current.style.height = '0px'
    input.current.style.height = `${Math.max(24, input.current.scrollHeight)}px`
  }, [multiline, value, focused, mentions])
  const control: MentionInputControl = {
    ref: (node) => { input.current = node }, value: projection.text,
    role: mentions ? 'combobox' : undefined, 'aria-autocomplete': mentions ? 'list' : undefined, 'aria-expanded': mentions ? open : undefined,
    'aria-controls': open ? listId : undefined, 'aria-activedescendant': open && candidates[active] ? `${listId}-${active}` : undefined,
    onFocus: (event) => { if (mentions) setFocused(true); onFocus?.(event) },
    onChange: (event) => {
      const raw = event.target.value
      // A mask must never strip a trigger or a persisted reference.
      const next = mentions && mask && !projection.spans.length && !/(?:^|\s)@|@\{/.test(raw) ? applyMask(mask, raw) : raw
      const edited = editMentionProjection(projection, next, selection.current)
      pendingCursor.current = (event.nativeEvent as InputEvent).isComposing ? null : edited.cursor
      onValueChange(edited.value)
      if (mentions) detect(next, next === raw ? event.target.selectionStart : next.length)
    },
    onSelect: (event) => {
      selection.current = { start: event.currentTarget.selectionStart ?? 0, end: event.currentTarget.selectionEnd ?? 0 }
      if (focused && mentions) detect(event.currentTarget.value, event.currentTarget.selectionStart)
    },
    onBlur: (event) => { if (mentions) { setFocused(false); setTrigger(null) }; onBlur?.(event) },
    onKeyDown: (event) => {
        if (event.nativeEvent.isComposing) return
        const start = event.currentTarget.selectionStart ?? 0, end = event.currentTarget.selectionEnd ?? start
        selection.current = { start, end }
        if (start === end && ['Backspace', 'Delete'].includes(event.key)) {
          const span = projection.spans.find((span) => event.key === 'Backspace' ? start > span.from && start <= span.to : start >= span.from && start < span.to)
          if (span) {
            event.preventDefault()
            pendingCursor.current = span.rawFrom
            onValueChange(value.slice(0, span.rawFrom) + value.slice(span.rawTo))
            setTrigger(null)
            return
          }
        }
        if (open && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation()
          if (event.key === 'Escape') setTrigger(null)
          else if (event.key === 'Enter' && candidates[active]) choose(candidates[active])
          else setActive((current) => candidates.length ? (current + (event.key === 'ArrowUp' ? -1 : 1) + candidates.length) % candidates.length : 0)
          return
        }
        onKeyDown?.(event)
    },
  }
  return <div className={cn('relative min-w-0 w-full', renderInput ? className : undefined)}>
    {renderInput ? renderInput(control) : multiline ? <textarea {...control} aria-label={props['aria-label'] ?? props.label} aria-invalid={props['aria-invalid']} autoFocus={props.autoFocus} readOnly={props.readOnly} disabled={props.disabled} placeholder={props.placeholder} maxLength={props.maxLength} rows={1} style={props.style} className={cn('block w-full min-w-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded border border-transparent bg-transparent text-sm outline-none [overflow-wrap:anywhere]', props.inputClassName, className)} /> : <TextField {...props} {...control} mask={mentions ? undefined : mask} className={className} />}
    {open && createPortal(<div id={listId} role="listbox" aria-label={mentions!.label} style={position}
      className="fixed z-50 max-h-72 w-80 max-w-[85vw] overflow-auto rounded-xl border border-divider bg-background p-1.5 shadow-xl">
      {!candidates.length && <p className="p-3 text-xs opacity-60">{mentions!.empty}</p>}
      {candidates.map((option, index) => <div key={option.id}>
        {(index === 0 || candidates[index - 1]!.section !== option.section) && <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide opacity-50">{option.section}</p>}
        <button id={`${listId}-${index}`} type="button" role="option" aria-selected={index === active}
          className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs', index === active && 'bg-p-purple/10 text-p-purple')}
          onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
          <span className="min-w-0 truncate">{displayMentionText(option.label, mentions?.resolve, mentions?.unavailable)}</span><span className="max-w-28 truncate opacity-50">{displayMentionText(option.value, mentions?.resolve, mentions?.unavailable)}</span>
        </button>
      </div>)}
    </div>, document.body)}
  </div>
}
