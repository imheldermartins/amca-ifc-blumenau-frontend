import { useQuery, useQueryClient } from '@tanstack/react-query'
import { displayMentionText } from 'cubs-components'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useWorkspace } from './WorkspaceContext'
import { MentionProvider } from '@/hooks/useMention'
import { mentionService } from '@/services/MentionService'
import { i18n } from '@/lib/i18n'
import { formatDatetimeMention, mentionId, parseMentionId, resolveMentionText, type MentionOption, type MentionScope } from '@/shared/mentions'

/** A new scope owns its catalog and registered references; nothing bleeds across pages. */
export function MentionScopeProvider({ children, scope }: { children: ReactNode; scope: MentionScope }) {
  const identity = JSON.stringify(scope)
  return <ScopedMentions key={identity} scope={scope}>{children}</ScopedMentions>
}

function ScopedMentions({ children, scope }: { children: ReactNode; scope: MentionScope }) {
  const { user } = useAuth()
  const client = useQueryClient()
  useEffect(() => client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'success' && ['workspace', 'workspaces', 'organization', 'organizations'].includes(String(event.query.queryKey[0]))) {
      void client.invalidateQueries({ queryKey: ['mentions', user?.id] })
    }
  }), [client, user?.id])
  const [groups, setGroups] = useState<Record<string, Record<string, string>>>({})
  const [registered, setRegistered] = useState<string[]>([])
  const [today] = useState(() => new Date().toISOString())
  const catalog = useQuery({ queryKey: ['mentions', user?.id, scope, 'catalog'], queryFn: () => mentionService.catalog(scope), enabled: Boolean(user), refetchInterval: 30_000 })
  const options = useMemo(() => {
    const result: MentionOption[] = []
    const add = (kind: 'users' | 'pages' | 'workspace' | 'organization', id: string, field: string, value: unknown, owner?: string) => {
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' && value !== null) return
      const label = field.startsWith('data.') ? field.slice(5) : i18n(`mentions.fields.${field}`)
      result.push({ id: mentionId(kind, id, field), label: owner ? `${owner} · ${label}` : label, value: String(value ?? ''), section: i18n(`mentions.sections.${kind}`), search: `${kind}.${field} ${owner ?? ''} ${value ?? ''}` })
    }
    const people = [...(user ? [user] : []), ...(catalog.data?.users ?? []).filter((person) => person.id !== user?.id)]
    people.forEach((person) => {
      const owner = `${person.name || person.email}${person.id === user?.id ? ` (${i18n('mentions.me')})` : ''}`
      add('users', person.id, 'name', person.name, owner); add('users', person.id, 'email', person.email, owner)
    })
    const page = catalog.data?.page
    if (page) {
      add('pages', page.id, 'title', page.title)
      page.columns?.forEach((column) => result.push({
        id: mentionId('pages', page.id, `columns.${column.id}`), label: column.name, value: column.value,
        section: i18n('mentions.sections.pages'), search: `page.columns.values ${column.name} ${column.value}`,
      }))
    }
    for (const kind of ['workspace', 'organization'] as const) {
      const entity = catalog.data?.[kind]
      if (!entity) continue
      add(kind, entity.id, 'name', entity.name)
      Object.entries(entity.data).forEach(([key, value]) => add(kind, entity.id, `data.${key}`, value))
    }
    result.push({ id: today, label: i18n('mentions.today'), value: formatDatetimeMention(today)!, section: i18n('mentions.sections.global'), search: '@hoje hoje datetime' })
    return result
  }, [catalog.data, user, today])
  const ids = useMemo(() => [...new Set([...options.map((option) => option.id).filter((id) => parseMentionId(id)), ...registered])].sort(), [options, registered])
  const catalogSignature = JSON.stringify(options.map((option) => [option.id, option.value]))
  const resolved = useQuery({
    queryKey: ['mentions', user?.id, scope, 'values', ids, catalogSignature], enabled: Boolean(user && ids.length),
    queryFn: async () => {
      const values: Record<string, string | null> = {}
      for (let i = 0; i < ids.length; i += 100) Object.assign(values, await mentionService.resolve(scope, ids.slice(i, i + 100)))
      return values
    }, refetchInterval: 30_000,
  })
  const values = useMemo(() => {
    const source = { ...Object.fromEntries(options.map((option) => [option.id, option.value])), ...resolved.data }
    return Object.fromEntries(Object.entries(source).map(([id, text]) => [id, text === null ? null : displayMentionText(text, (token) => resolveMentionText(token, source, i18n('mentions.unavailable')), i18n('mentions.unavailable'))]))
  }, [options, resolved.data])
  const register = useCallback((incoming: string[]) => setRegistered((current) => {
    const next = [...new Set([...current, ...incoming.filter((id) => parseMentionId(id))])].sort()
    return next.length === current.length ? current : next
  }), [])
  const addMentionsGroup = useCallback((name: string, entries: Record<string, string>) => setGroups((current) => ({ ...current, [name]: entries })), [])
  const mentions = useMemo(() => {
    const result = { ...groups }
    options.forEach((option) => { const kind = parseMentionId(option.id)?.kind ?? 'global'; result[kind] = { ...result[kind], [option.id]: option.value } })
    return result
  }, [groups, options])
  const resolve = useCallback((text: string) => displayMentionText(text, (token) => resolveMentionText(token, values, i18n('mentions.unavailable')), i18n('mentions.unavailable')), [values])
  const visibleOptions = useMemo(() => options.map((option) => ({ ...option, label: resolve(option.label), value: resolve(option.value) })), [options, resolve])
  const value = useMemo(() => ({ mentions, addMentionsGroup, options: visibleOptions, values, scope, resolve, register, loading: catalog.isPending }), [mentions, addMentionsGroup, visibleOptions, values, scope, resolve, register, catalog.isPending])
  return <MentionProvider value={value}>{children}</MentionProvider>
}

export function MentionContext({ children }: { children: ReactNode }) {
  const { workspaceId } = useWorkspace()
  return <MentionScopeProvider scope={workspaceId ? { workspaceId } : {}}>{children}</MentionScopeProvider>
}
