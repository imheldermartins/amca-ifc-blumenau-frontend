import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { TextField, type TextFieldProps } from './TextField'
import { cn } from './lib/utils'
import { applyMask } from './lib/masks'

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
export interface MentionTextFieldProps extends Omit<TextFieldProps, 'name' | 'value' | 'onChange'> {
  value: string
  onValueChange: (value: string) => void
  mentions?: MentionInputConfig
  /** Keep an existing native input's exact markup and styling. */
  renderInput?: (control: MentionInputControl) => ReactNode
}
type MentionInputControl = Pick<ComponentProps<'input'>, 'ref' | 'value' | 'role' | 'aria-autocomplete' | 'aria-expanded' | 'aria-controls' | 'aria-activedescendant' | 'onFocus' | 'onBlur' | 'onChange' | 'onSelect' | 'onKeyDown'>

/** Raw template while editing, resolved value while idle. Selection never commits on blur. */
export function MentionTextField({ value, onValueChange, mentions, onFocus, onBlur, onKeyDown, className, renderInput, mask, ...props }: MentionTextFieldProps) {
  const input = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const [trigger, setTrigger] = useState<{ from: number; to: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  const listId = useId()
  const track = mentions?.track
  useEffect(() => { track?.(value) }, [track, value])
  const candidates = mentions?.options.filter((option) => `${option.label} ${option.search ?? ''}`.toLocaleLowerCase().includes(trigger?.query.toLocaleLowerCase() ?? '')).slice(0, 50) ?? []
  const detect = (text: string, cursor: number | null) => {
    const prefix = text.slice(0, cursor ?? text.length)
    const match = /(?:^|\s)@([^@{}\s]*)$/.exec(prefix)
    setActive(0)
    setTrigger(match ? { from: prefix.lastIndexOf('@'), to: prefix.length, query: match[1]! } : null)
  }
  const choose = (option: MentionInputOption) => {
    if (!trigger || !mentions) return
    const inserted = mentions.token(option.id)
    const next = value.slice(0, trigger.from) + inserted + value.slice(trigger.to)
    onValueChange(next); setTrigger(null)
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(trigger.from + inserted.length, trigger.from + inserted.length) })
  }
  const open = focused && Boolean(trigger && mentions)
  const [position, setPosition] = useState({ left: 8, top: 8 })
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = input.current?.getBoundingClientRect()
      if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 336)), top: Math.max(8, rect.bottom + 300 < window.innerHeight ? rect.bottom + 4 : rect.top - 296) })
    }
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true)
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true) }
  }, [open])
  const control: MentionInputControl = {
    ref: input, value: focused ? value : mentions?.resolve(value) ?? value,
    role: mentions ? 'combobox' : undefined, 'aria-autocomplete': mentions ? 'list' : undefined, 'aria-expanded': mentions ? open : undefined,
    'aria-controls': open ? listId : undefined, 'aria-activedescendant': open && candidates[active] ? `${listId}-${active}` : undefined,
    onFocus: (event) => { if (mentions) setFocused(true); onFocus?.(event) },
    onChange: (event) => {
      const raw = event.target.value
      // A mask must never strip a trigger or a persisted reference.
      const next = mentions && mask && !/(?:^|\s)@|@\{/.test(raw) ? applyMask(mask, raw) : raw
      onValueChange(next)
      if (mentions) detect(next, next === raw ? event.target.selectionStart : next.length)
    },
    onSelect: (event) => { if (focused && mentions) detect(event.currentTarget.value, event.currentTarget.selectionStart) },
    onBlur: (event) => { if (mentions) { setFocused(false); setTrigger(null) }; onBlur?.(event) },
    onKeyDown: (event) => {
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
    {renderInput ? renderInput(control) : <TextField {...props} {...control} mask={mentions ? undefined : mask} className={className} />}
    {open && createPortal(<div id={listId} role="listbox" aria-label={mentions!.label} style={position}
      className="fixed z-50 max-h-72 w-80 max-w-[85vw] overflow-auto rounded-xl border border-divider bg-background p-1.5 shadow-xl">
      {!candidates.length && <p className="p-3 text-xs opacity-60">{mentions!.empty}</p>}
      {candidates.map((option, index) => <div key={option.id}>
        {(index === 0 || candidates[index - 1]!.section !== option.section) && <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wide opacity-50">{option.section}</p>}
        <button id={`${listId}-${index}`} type="button" role="option" aria-selected={index === active}
          className={cn('flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs', index === active && 'bg-p-purple/10 text-p-purple')}
          onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
          <span className="min-w-0 truncate">{option.label}</span><span className="max-w-28 truncate opacity-50">{option.value}</span>
        </button>
      </div>)}
    </div>, document.body)}
  </div>
}
