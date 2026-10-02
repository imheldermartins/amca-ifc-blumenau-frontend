import { useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { Button, Checkbox, Popover, Switch, cn } from 'cubs-components'

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
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    if (!needle) return editors
    return editors.filter((editor) =>
      `${editor.name ?? ''} ${editor.email}`.toLocaleLowerCase().includes(needle),
    )
  }, [editors, search])

  return <section className="grid gap-3 border-t border-divider pt-5">
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
            trigger={<Button variant="text" color="from-theme" className="shrink-0 px-2 py-1 text-xs">
              <Icon icon="lucide:users" className="size-3.5" />
              {labels.allowed} · {selected.length}
            </Button>}
          >
            <div className="w-72">
              <label className="flex items-center gap-2 rounded-md border border-divider px-2.5">
                <Icon icon="lucide:search" className="size-3.5 opacity-55" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={labels.search}
                  className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
                />
              </label>
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {!filtered.length && <p className="p-2 text-xs opacity-60">{labels.empty}</p>}
                {filtered.map((editor) => {
                  const checked = selected.includes(editor.id)
                  const actor = editor.id === currentUserId
                  return <label key={editor.id} className={cn('flex items-center gap-2 rounded-md px-2 py-2 text-xs hover:bg-active', actor && 'cursor-default')}>
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
                      {editor.name && <span className="block truncate opacity-55">{editor.email}</span>}
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
