import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { MentionInputConfig } from 'cubs-components'
import type { HeaderCol, RowData } from './types'

const DatabaseMentions = createContext<MentionInputConfig | undefined>(undefined)
export const DatabaseMentionProvider = DatabaseMentions.Provider
const MentionPage = createContext<string | undefined>(undefined)
const MentionColumns = createContext<HeaderCol[] | undefined>(undefined)
export const DatabaseMentionColumnsProvider = MentionColumns.Provider

export interface PageMentionData {
  id: string
  title: string | null
  titleName?: string
  columns: { id: string; name: string; value: string }[]
}

const reference = (pageId: string, field: string) => `pages:${pageId}:${encodeURIComponent(field)}`

/** Reusable page scope: rows, cards and other page editors share this provider. */
export function PageMentionProvider({ page, children }: { page: PageMentionData; children: ReactNode }) {
  const parent = useContext(DatabaseMentions)
  const value = useMemo(() => {
    if (!parent) return undefined
    const pageOption = parent.options.find((option) => option.id.startsWith('pages:') && option.id.endsWith(':title'))
    const section = pageOption?.section ?? 'Página atual'
    const entries = [
      { id: reference(page.id, 'title'), label: page.titleName ?? pageOption?.label ?? 'Título', value: page.title ?? '', section, search: 'page.title' },
      ...page.columns.map((column) => ({ id: reference(page.id, `columns.${column.id}`), label: column.name,
        value: column.value, section, search: `page.columns.values ${column.name} ${column.value}` })),
    ]
    const values = new Map(entries.map((entry) => [entry.id, entry.value]))
    const resolve = (text: string) => {
      let budget = 100
      const cache = new Map<string, string | null>()
      const expand = (input: string, path: Set<string>): string | null => {
        if (path.size > 8 || input.length > 20_000) return null
        let unavailable = false, size = input.length
        const result = input.replace(/@\{([^{}]{1,1600})\}/g, (token, id: string) => {
          if (unavailable) return ''
          let resolved: string | null
          if (!values.has(id)) resolved = parent.resolve(token)
          else if (path.has(id)) resolved = null
          else if (cache.has(id)) resolved = cache.get(id)!
          else {
            resolved = --budget < 0 ? null : expand(values.get(id)!, new Set(path).add(id))
            cache.set(id, resolved)
          }
          size += (resolved?.length ?? 0) - token.length
          if (resolved === null || size > 20_000) unavailable = true
          return unavailable ? '' : resolved!
        })
        return unavailable ? null : result
      }
      return expand(text, new Set()) ?? parent.unavailable ?? ''
    }
    return { ...parent,
      // A row replaces the containing database's page scope.
      options: [...parent.options.filter((option) => !option.id.startsWith('pages:')), ...entries.map((entry) => ({ ...entry, value: resolve(entry.value) }))],
      resolve,
    }
  }, [page, parent])
  return <MentionPage value={page.id}><DatabaseMentionProvider value={value}>{children}</DatabaseMentionProvider></MentionPage>
}

/** Adapter only; the mention scope is a page, independently of view. */
export function RowMentionProvider({ row, columns, children }: { row: RowData; columns: HeaderCol[]; children: ReactNode }) {
  const allColumns = useContext(MentionColumns) ?? columns
  const page = useMemo<PageMentionData>(() => {
    const title = allColumns.find((column) => column.key === 'title' || column.id === 'page_title')
    return { id: row.id, title: String(row.cells[title?.id ?? 'page_title']?.value ?? ''), titleName: columns.find((column) => column.key === 'title')?.title ?? title?.title,
      columns: allColumns.filter((column) => column !== title && ['text', 'numeric', 'checkbox', 'date', 'select'].includes(column.type ?? 'text')).map((column) => {
        const raw = row.cells[column.id]?.value
        const value = column.type === 'select' ? column.options?.find((option) => option.id === raw)?.label : raw
        return { id: column.id, name: column.title, value: value == null ? '' : String(value) }
      }),
    }
  }, [row, allColumns, columns])
  return <PageMentionProvider page={page}>{children}</PageMentionProvider>
}

export function useDatabaseMentions(column?: HeaderCol) {
  const mentions = useContext(DatabaseMentions)
  const pageId = useContext(MentionPage)
  return useMemo(() => {
    if (!mentions || !column || !pageId) return mentions
    const own = reference(pageId, column.key === 'title' ? 'title' : `columns.${column.id}`)
    return { ...mentions, options: mentions.options.filter((option) => option.id !== own) }
  }, [mentions, column, pageId])
}
export function DatabaseMentionText({ value }: { value: string }) {
  const mentions = useDatabaseMentions()
  const track = mentions?.track
  useEffect(() => { track?.(value) }, [track, value])
  return <>{mentions?.resolve(value) ?? value}</>
}
