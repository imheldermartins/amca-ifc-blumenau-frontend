import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { workspaceService, type ApiWorkspace, type ApiOrganization } from '@/services/WorkspaceService'

function VariableValue({ name, value, pending, save, remove }: {
  name: string; value: string; pending: boolean; save: (value: string) => void; remove: () => void
}) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  useEffect(() => {
    if (draft === value) dirty.current = false
    else if (!dirty.current) setDraft(value)
  }, [value, draft])
  return <tr>
    <td className="py-2 pr-5 align-middle"><code className="break-all text-sm">{name}</code></td>
    <td className="py-2"><input className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-sm outline-none focus:border-p-purple"
      aria-label={i18n('pages.workspaces.variables.value-for', { key: name })} value={draft} disabled={pending} maxLength={10_000}
      onChange={(event) => { dirty.current = true; setDraft(event.target.value) }}
      onBlur={() => { if (draft !== value) save(draft); else dirty.current = false }}
      onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }} /></td>
    <td className="w-10 py-2 pl-2"><button type="button" disabled={pending} aria-label={i18n('pages.workspaces.variables.remove', { key: name })}
      className="rounded-lg p-2 opacity-50 hover:bg-active hover:opacity-100" onClick={remove}><Icon icon="lucide:x" fontSize={16} /></button></td>
  </tr>
}

export function ScopeVariablesEditor({ scope, entity, canEdit }: {
  scope: 'workspace' | 'organization'; entity: { id: string; data: Record<string, unknown> }; canEdit: boolean
}) {
  const { user } = useAuth()
  const feedback = useFeedback()
  const client = useQueryClient()
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  useEffect(() => { setKey(''); setValue('') }, [entity.id])
  const mutation = useMutation({
    mutationFn: (input: { scope: 'workspace' | 'organization'; entityId: string; actor: string; key: string; value: string | null }): Promise<ApiWorkspace | ApiOrganization> => input.scope === 'workspace'
      ? workspaceService.setVariable(input.entityId, input.key, input.value) : workspaceService.setOrganizationVariable(input.entityId, input.key, input.value),
    onSuccess: (saved, input) => {
      const merge = (current: ApiWorkspace | ApiOrganization | undefined) => {
        const next = { ...(current ?? saved), data: { ...(current?.data ?? saved.data) } }
        if (input.value === null) delete next.data[input.key]
        else Object.defineProperty(next.data, input.key, { value: input.value, enumerable: true, configurable: true, writable: true })
        return next
      }
      client.setQueryData([input.scope, input.actor, input.entityId], merge)
      client.setQueryData<Array<ApiWorkspace | ApiOrganization>>([input.scope === 'workspace' ? 'workspaces' : 'organizations', input.actor], (current) => current?.map((item) => item.id === input.entityId ? merge(item) : item))
      void client.invalidateQueries({ queryKey: ['mentions'] })
      feedback({ title: i18n('pages.workspaces.variables.saved'), variant: 'success' })
    },
    onError: () => feedback({ title: i18n('pages.workspaces.variables.error'), variant: 'error' }),
  })
  const entries = Object.entries(entity.data).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  return <section aria-label={i18n('pages.workspaces.settings.variables')} className="space-y-5">
    <p className="text-sm opacity-60">{i18n('pages.workspaces.variables.description')}</p>
    <form onSubmit={(event) => {
      event.preventDefault()
      const name = key.trim()
      if (!name || !canEdit || mutation.isPending || !user) return
      mutation.mutate({ scope, entityId: entity.id, actor: user.id, key: name, value }, { onSuccess: () => { setKey(''); setValue('') } })
    }}>
      <table className="w-full table-fixed border-collapse text-left">
        <thead className="text-xs uppercase tracking-wide opacity-55"><tr>
          <th className="w-1/3 pb-3 font-medium">{i18n('pages.workspaces.variables.key')}</th>
          <th className="pb-3 font-medium">{i18n('pages.workspaces.variables.value')}</th><th className="w-10" />
        </tr></thead>
        <tbody>{entries.map(([name, stored]) => <VariableValue key={`${entity.id}:${name}`} name={name} value={stored}
          pending={!canEdit || mutation.isPending} save={(next) => { if (user) mutation.mutate({ scope, entityId: entity.id, actor: user.id, key: name, value: next }) }}
          remove={() => { if (user) mutation.mutate({ scope, entityId: entity.id, actor: user.id, key: name, value: null }) }} />)}
          {canEdit && <tr>
            <td className="py-2 pr-5"><input aria-label={i18n('pages.workspaces.variables.new-key')} placeholder={i18n('pages.workspaces.variables.new-key')}
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-sm outline-none focus:border-p-purple" maxLength={120} value={key} disabled={mutation.isPending} onChange={(event) => setKey(event.target.value)} /></td>
            <td className="py-2"><input aria-label={i18n('pages.workspaces.variables.new-value')} placeholder={i18n('pages.workspaces.variables.new-value')}
              className="w-full rounded-lg border border-divider bg-background px-3 py-2 text-sm outline-none focus:border-p-purple" maxLength={10_000} value={value} disabled={mutation.isPending} onChange={(event) => setValue(event.target.value)} /></td>
            <td className="py-2 pl-2"><button type="submit" disabled={!key.trim() || mutation.isPending} aria-label={i18n('pages.workspaces.variables.add')}
              className="rounded-lg p-2 text-p-purple hover:bg-active disabled:opacity-30"><Icon icon="lucide:plus" fontSize={16} /></button></td>
          </tr>}
        </tbody>
      </table>
    </form>
  </section>
}
