import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button, Tooltip } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { currentWorkspaceSession } from '@/lib/currentWorkspaceSession'
import { i18n } from '@/lib/i18n'
import { replaceQuery } from '@/lib/queryParams'
import { workspacePreference } from '@/lib/workspacePreference'
import { workspaceService, type ApiWorkspace } from '@/services/WorkspaceService'
import { WorkspacesCards } from '@/routes/$lang/_authenticated/workspaces/-components/WorkspacesCards'

export function WorkspaceSelectorPage() {
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const queryParams = useQueryParams<'choose'>()
  const { user } = useAuth()
  const [, refreshPreference] = useState(0)
  const leavingPageRef = useRef(false)
  const chooseExplicitly = queryParams.getBoolean('choose') === true

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
    ) return
    const preferred = workspacePreference.resolve(user.id, workspaces.data)
    if (!preferred) return
    void navigate({
      to: '/$lang/workspace/$workspaceId',
      params: { lang, workspaceId: preferred.id },
      replace: true,
    })
  }, [chooseExplicitly, lang, navigate, user, workspaces.data])

  function openWorkspace(workspace: ApiWorkspace) {
    leavingPageRef.current = true
    void navigate({
      to: '/$lang/workspace/$workspaceId',
      params: { lang, workspaceId: workspace.id },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  function openWorkspaceSettings(workspace: ApiWorkspace) {
    leavingPageRef.current = true
    if (user) currentWorkspaceSession.set(user.id, workspace.id)
    void navigate({
      to: '/$lang/workspaces/$workspaceId/settings/general',
      params: { lang, workspaceId: workspace.id },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  const preferredId = user ? workspacePreference.get(user.id) : undefined
  const workspaceGroups = [
    {
      key: 'personal',
      title: i18n('pages.workspaces.selector.personal-section'),
      items: workspaces.data?.filter((workspace) => workspace.isPersonal) ?? [],
    },
    {
      key: 'organization',
      title: i18n('pages.workspaces.selector.organization-section'),
      items: workspaces.data?.filter((workspace) => !workspace.isPersonal) ?? [],
    },
  ].filter((group) => group.items.length > 0)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background text-foreground pt-10">
      <section className="flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-row justify-between items-center mb-6">
          <div>
            <Typography variant="h1">{i18n('pages.workspaces.selector.title')}</Typography>
            <Typography variant="body" as="p" className="mt-2 text-dark-100 dark:text-light-900">
              {i18n('pages.workspaces.selector.subtitle')}
            </Typography>
          </div>
          <div className='flex items-center gap-3'>
            <Button 
              variant='text'
              onClick={() => {
                leavingPageRef.current = true
                void navigate({ to: '/$lang/organizations', params: { lang } })
              }}>
              {i18n('pages.workspaces.selector.organizations-link')}
            </Button>
            <Tooltip content={i18n('pages.workspaces.selector.new')}>
            <Button
              type="button"
              variant="filled"
              className='p-4 rounded-full'
              onClick={() => {
                leavingPageRef.current = true
                void navigate({
                  to: '/$lang/workspaces/new',
                  params: { lang },
                  search: {},
                })
              }}
            >
              <Icon icon="lucide:plus" className="size-5" />
            </Button>
          </Tooltip>
          </div>
        </header>

        <div
          aria-label={i18n('pages.workspaces.selector.list-label')}
          className="pb-6"
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
                <div className="block w-full">
                  {workspaceGroups.map((group) => (
                    <section key={group.key} aria-labelledby={`workspace-group-${group.key}`} className="w-full mb-8">
                      <Typography id={`workspace-group-${group.key}`} variant="h2" as="h2" className="mb-6 px-1">
                        {group.title}
                      </Typography>
                      <ul className="grid grid-cols-3 gap-3">
                        {group.items.map((workspace) => {
                          const ownerLabel = workspace.owner.email ?
                            `${workspace.owner.name ? `${workspace.owner.name} · ` : ''}${workspace.owner.email}`
                            : i18n('pages.workspaces.selector.owner-unknown');
                          const organizationName = workspace.organizationName;
                          const workspaceName = workspace.name;
                          const headerLabel = organizationName ? `${organizationName} • ${workspaceName}` : `${workspaceName}`;
                          return (
                            <WorkspacesCards
                              key={workspace.id}
                              workspace={workspace}
                              headerLabel={headerLabel}
                              ownerLabel={ownerLabel}
                              preferredId={preferredId ?? null}
                              user={user}
                              refreshPreference={refreshPreference}
                              openWorkspace={openWorkspace}
                              openWorkspaceSettings={openWorkspaceSettings}
                            />
                          )
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
        </div>
      </section>
    </main>
  )
}
