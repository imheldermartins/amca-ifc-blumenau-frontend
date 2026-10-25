import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import { useEffect, useRef, useState } from 'react'
import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { useOrganizationSettings } from '@/hooks/useOrganizationSettings'
import { i18n } from '@/lib/i18n'
import { can } from '@/services/AccessService'
import { workspaceService, type ApiOrganization, type ApiWorkspace } from '@/services/WorkspaceService'

export function OrganizationSettingsHeader({ section }: { section: string }) {
  const organization = useOrganizationSettings()
  const { user } = useAuth()
  const client = useQueryClient()
  const feedback = useFeedback()
  const [draft, setDraft] = useState(organization.name)
  const [invalid, setInvalid] = useState(false)
  const dirty = useRef(false), saving = useRef(false), cancel = useRef(false)
  useEffect(() => { if (!dirty.current) setDraft(organization.name) }, [organization.name])
  const mutation = useMutation({
    mutationFn: (input: { id: string; actor: string; name: string }) => workspaceService.updateOrganization(input.id, input.name),
    onSuccess: (saved, input) => {
      client.setQueryData(['organization', input.actor, input.id], saved)
      client.setQueryData<ApiOrganization[]>(['organizations', input.actor], (current) => current?.map((item) => item.id === saved.id ? { ...item, name: saved.name } : item))
      client.setQueriesData<ApiWorkspace>({ queryKey: ['workspace', input.actor] }, (current) => current?.organizationId === saved.id ? { ...current, organizationName: saved.name } : current)
      client.setQueryData<ApiWorkspace[]>(['workspaces', input.actor], (current) => current?.map((item) => item.organizationId === saved.id ? { ...item, organizationName: saved.name } : item))
      void client.invalidateQueries({ queryKey: ['mentions'] })
      dirty.current = false; setDraft(saved.name)
      feedback({ title: i18n('organization.settings.saved'), variant: 'success' })
    },
    onError: () => feedback({ title: i18n('organization.settings.save-error'), variant: 'error' }),
    onSettled: () => { saving.current = false },
  })
  const save = () => {
    if (cancel.current) { cancel.current = false; return }
    if (!user || saving.current || !can(organization, 'write', 'update')) return
    const name = draft.trim().replace(/\s+/g, ' ')
    setInvalid(!name || name.length > 120)
    if (!name || name.length > 120 || name === organization.name) return
    saving.current = true; mutation.mutate({ id: organization.id, actor: user.id, name })
  }
  return <header className="mb-8">
    <nav aria-label={i18n('organization.settings.breadcrumb')} className="mb-7 flex flex-wrap items-center gap-2 text-xs text-foreground/60">
      <span>{i18n('organization.single')}</span><Icon icon="lucide:chevron-right" className="size-3" aria-hidden />
      <span>{i18n('pages.workspaces.settings.navigation')}</span><Icon icon="lucide:chevron-right" className="size-3" aria-hidden />
      <span aria-current="page" className="text-foreground">{section}</span>
    </nav>
    <Typography variant="caption" as="p" className="mb-1 text-foreground/60">{i18n('organization.single')}</Typography>
    <Typography variant="h1" className="min-w-0"><input value={draft} maxLength={120} autoComplete="off"
      aria-label={i18n('organization.name')} aria-invalid={invalid || undefined} readOnly={!can(organization, 'write', 'update') || mutation.isPending}
      className="min-h-[1.2em] w-full border-0 bg-transparent p-0 text-inherit shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
      style={{ fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 'inherit', letterSpacing: 'inherit' }}
      onChange={(event) => { dirty.current = true; setDraft(event.target.value); setInvalid(false) }} onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        if (event.key === 'Escape' && !saving.current) { event.preventDefault(); cancel.current = true; dirty.current = false; setDraft(organization.name); setInvalid(false); event.currentTarget.blur() }
      }} /></Typography>
    {invalid && <p role="alert" className="mt-2 text-xs text-p-red">{i18n('organization.settings.name-required')}</p>}
  </header>
}
