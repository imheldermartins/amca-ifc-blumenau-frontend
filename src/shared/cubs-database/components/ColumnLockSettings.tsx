import { useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button, Checkbox, Popover, SOFT_SELECTION_CLASSES, Switch, TextField, cn } from 'cubs-components'

import type { ColumnLockEditor, ColumnLockMap, HeaderCol } from '../types'

export interface ColumnLockSettingsLabels {
  title: string
  description: string
  search: string
  empty: string
  allowed: string
  locked: string
}

const keyOf = (column: HeaderCol) => column.key === 'title' ? 'title' : column.id

export function ColumnLockSettings({
  columns,
  locks,
  editors,
  currentUserId,
  onChange,
  labels,
}: {
  columns: HeaderCol[]
  locks: ColumnLockMap
  editors: ColumnLockEditor[]
  currentUserId: string
  onChange: (columnKey: string, userIds: string[]) => void
  labels: ColumnLockSettingsLabels
}) {
  const [search, setSearch] = useState('')
  const [sectionElement, setSectionElement] = useState<HTMLElement | null>(null)
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    if (!needle) return editors
    return editors.filter((editor) =>
      `${editor.name ?? ''} ${editor.email}`.toLocaleLowerCase().includes(needle),
    )
  }, [editors, search])

  return <section ref={setSectionElement} className="grid gap-3 border-t border-divider pt-5">
    <div className="flex items-start gap-2">
      <Icon icon="lucide:lock-keyhole" className="mt-0.5 size-4 shrink-0 text-p-purple" />
      <div>
        <h3 className="text-sm font-semibold">{labels.title}</h3>
        <p className="mt-1 text-xs leading-5 opacity-60">{labels.description}</p>
      </div>
    </div>
    <div className="grid gap-2">
      {columns.map((column) => {
        const columnKey = keyOf(column)
        const selected = locks[columnKey]?.userIds ?? []
        const enabled = Boolean(locks[columnKey])
        return <div key={columnKey} className="flex items-center gap-3 rounded-lg border border-divider px-3 py-2.5">
          <Switch
            checked={enabled}
            label={column.title}
            className="min-w-0 flex-1"
            onCheckedChange={(checked) => onChange(columnKey, checked ? [currentUserId] : [])}
          />
          {enabled && <Popover
            side="left"
            align="start"
            className="p-2"
            portalContainer={sectionElement?.closest<HTMLElement>('[data-drawer-content]')}
            trigger={<Button variant="text" color="from-theme" className="shrink-0 px-2 py-1 text-xs">
              <Icon icon="lucide:users" className="size-3.5" />
              {labels.allowed} · {selected.length}
            </Button>}
          >
            <div className="w-72">
              <TextField
                type="search"
                size="sm"
                surface="plain"
                aria-label={labels.search}
                placeholder={labels.search}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="group/search"
                startAdornment={<Icon icon="lucide:search" className="size-3.5 opacity-60 transition-colors group-focus-within/search:text-p-purple" />}
                inputClassName="rounded-lg border-light-100/60 bg-floating-input text-xs shadow-sm shadow-p-purple/10 transition-[background-color,border-color,box-shadow] focus-visible:border-p-purple/30 focus-visible:ring-2 focus-visible:ring-p-purple/15 focus-visible:shadow-md focus-visible:shadow-p-purple/15 dark:border-light-100/5"
              />
              <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
                {!filtered.length && <p className="p-2 text-xs opacity-60">{labels.empty}</p>}
                {filtered.map((editor) => {
                  const checked = selected.includes(editor.id)
                  const actor = editor.id === currentUserId
                  return <label key={editor.id} className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition-[color,background-color,box-shadow]',
                    'hover:bg-p-purple/10 hover:shadow-sm hover:shadow-p-purple/10 focus-within:bg-p-purple/10 focus-within:shadow-sm focus-within:shadow-p-purple/10',
                    checked && SOFT_SELECTION_CLASSES,
                    actor ? 'cursor-default' : 'cursor-pointer',
                  )}>
                    <Checkbox
                      checked={checked}
                      disabled={actor}
                      aria-label={`${labels.allowed}: ${editor.name || editor.email}`}
                      onCheckedChange={(next) => onChange(
                        columnKey,
                        next
                          ? [...new Set([...selected, editor.id])]
                          : selected.filter((id) => id !== editor.id),
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{editor.name || editor.email}</span>
                      {editor.name && <span className="block truncate text-dark-100 dark:text-light-900">{editor.email}</span>}
                    </span>
                  </label>
                })}
              </div>
            </div>
          </Popover>}
          {enabled && <span className="sr-only">{labels.locked}</span>}
        </div>
      })}
    </div>
  </section>
}
