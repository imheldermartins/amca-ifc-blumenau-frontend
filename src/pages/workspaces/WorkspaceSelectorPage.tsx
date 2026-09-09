import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button, Switch, cn } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { i18n } from '@/lib/i18n'
import { replaceQuery } from '@/lib/queryParams'
import { workspacePreference } from '@/lib/workspacePreference'
import { workspaceService, type ApiWorkspace } from '@/services/WorkspaceService'
import { OrganizationManagement } from './OrganizationManagement'

export function WorkspaceSelectorPage() {
  const { lang } = useParams({ strict: false })
  const navigate = useNavigate()
  const queryParams = useQueryParams<'choose' | 'tab'>()
  const { user } = useAuth()
  const [, refreshPreference] = useState(0)
  const leavingPageRef = useRef(false)
  const chooseExplicitly = queryParams.getBoolean('choose') === true
  const tab = queryParams.get('tab') === 'organization' ? 'organization' : 'workspaces'

  const workspaces = useQuery({
    queryKey: ['workspaces', user?.id ?? 'anonymous'],
    queryFn: () => workspaceService.listMine(),
    enabled: Boolean(user),
  })

  useEffect(() => {
    if (
      leavingPageRef.current
      || !user
      || !workspaces.data
      || chooseExplicitly
      || tab === 'organization'
    ) return
    const preferred = workspacePreference.resolve(user.id, workspaces.data)
    if (!preferred) return
    void navigate({
      to: '/$lang/myworkspace/$workspaceId',
      params: { lang: lang ?? 'pt-br', workspaceId: preferred.id },
      replace: true,
    })
  }, [chooseExplicitly, lang, navigate, tab, user, workspaces.data])

  function openWorkspace(workspace: ApiWorkspace) {
    leavingPageRef.current = true
    void navigate({
      to: '/$lang/myworkspace/$workspaceId',
      params: { lang: lang ?? 'pt-br', workspaceId: workspace.id },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  function openWorkspaceSettings(workspace: ApiWorkspace) {
    leavingPageRef.current = true
    void navigate({
      to: '/$lang/workspaces/$workspaceId/settings/general',
      params: { lang: lang ?? 'pt-br', workspaceId: workspace.id },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  const preferredId = user ? workspacePreference.get(user.id) : undefined

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="flex w-full max-w-5xl flex-col gap-6">
        <header className="text-center">
          <Typography variant="h1">{i18n('pages.workspaces.selector.title')}</Typography>
          <Typography variant="body" as="p" className="mt-2 text-dark-100 dark:text-light-900">
            {i18n('pages.workspaces.selector.subtitle')}
          </Typography>
        </header>

        <div
          role="tablist"
          aria-label={i18n('pages.workspaces.selector.tabs-label')}
          className="mx-auto grid w-full max-w-md grid-cols-2 rounded-lg bg-active p-1"
        >
          {(['workspaces', 'organization'] as const).map((candidate) => (
            <Button
              key={candidate}
              type="button"
              role="tab"
              aria-selected={tab === candidate}
              variant="text"
              color="from-theme"
              className={cn(tab === candidate && 'bg-background shadow-sm')}
              onClick={() => queryParams.set({ tab: candidate, choose: true }, { replace: true })}
            >
              {i18n(`pages.workspaces.selector.tab-${candidate}`)}
            </Button>
          ))}
        </div>

        {tab === 'organization' ? (
          <OrganizationManagement onLeave={() => { leavingPageRef.current = true }} />
        ) : (
          <>
            <div
              aria-label={i18n('pages.workspaces.selector.list-label')}
              className="max-h-[55vh] overflow-y-auto p-2"
            >
              {workspaces.isPending ? (
                <Typography variant="body" as="p" className="p-8 text-center">
                  {i18n('common.carregando')}
                </Typography>
              ) : workspaces.isError ? (
                <Typography variant="body" as="p" role="alert" className="p-8 text-center text-p-red">
                  {i18n('pages.workspaces.selector.error')}
                </Typography>
              ) : workspaces.data.length === 0 ? (
                <Typography variant="body" as="p" className="p-8 text-center text-dark-100 dark:text-light-900">
                  {i18n('pages.workspaces.selector.empty')}
                </Typography>
              ) : (
                <ul className="flex flex-col gap-2">
                  {workspaces.data.map((workspace) => (
                    <li
                      key={workspace.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-contrast p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-active">
                          <Icon icon={workspace.icon || 'lucide:boxes'} className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <Typography variant="subtitle" as="p" className="truncate">
                            {workspace.name ?? i18n('common.workspace.sem-nome')}
                          </Typography>
                          <Typography variant="caption" as="p" className="text-dark-100 dark:text-light-900">
                            {i18n(`pages.workspaces.selector.role-${workspace.role}`)}
                            {workspace.organizationName ? ` · ${workspace.organizationName}` : ''}
                          </Typography>
                          <Switch
                            checked={preferredId === workspace.id}
                            onCheckedChange={(checked) => {
                              if (!user) return
                              if (checked) workspacePreference.set(user.id, workspace.id)
                              else workspacePreference.clear(user.id)
                              refreshPreference((revision) => revision + 1)
                            }}
                            label={i18n('pages.workspaces.selector.preferred')}
                            className="mt-2 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {workspace.role === 'superadmin' && (
                          <Button
                            type="button"
                            variant="text"
                            color="from-theme"
                            className="shrink-0"
                            onClick={() => openWorkspaceSettings(workspace)}
                          >
                            <Icon icon="lucide:settings-2" className="size-4" />
                            {i18n('pages.workspaces.selector.settings')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="filled"
                          color="purple"
                          className="shrink-0"
                          onClick={() => openWorkspace(workspace)}
                        >
                          {i18n('pages.workspaces.selector.enter')}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Button
              type="button"
              variant="text"
              color="from-theme"
              className="mx-auto px-4"
              onClick={() => {
                leavingPageRef.current = true
                void navigate({
                  to: '/$lang/workspaces/new',
                  params: { lang: lang ?? 'pt-br' },
                  search: { tab: 'create' },
                })
              }}
            >
              <Icon icon="lucide:plus" className="size-4" />
              {i18n('pages.workspaces.selector.new')}
            </Button>
          </>
        )}
      </section>
    </main>
  )
}
