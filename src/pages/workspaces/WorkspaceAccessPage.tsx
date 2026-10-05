import { Icon } from '@iconify/react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useLanguage } from '@/contexts/LanguageContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { i18n } from '@/lib/i18n'
import { CreateWorkspaceForm } from './CreateWorkspaceForm'

export function WorkspaceAccessPage() {
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const query = useQueryParams<'organization'>()
  const requestedOrganizationId = query.get('organization')

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-2xl p-6">
        <Button
          type="button"
          variant="text"
          color="from-theme"
          className="mb-5 -ml-2"
          onClick={() => navigate({ to: '/$lang/workspaces', params: { lang }, search: { choose: true, tab: 'workspaces' } })}
        >
          <Icon icon="lucide:arrow-left" className="size-4" />
          {i18n('pages.workspaces.access.back')}
        </Button>

        <header>
          <Typography variant="h1">{i18n('pages.workspaces.access.title')}</Typography>
          <Typography variant="body" as="p" className="mt-2 text-dark-100 dark:text-light-900">
            {i18n('pages.workspaces.access.subtitle')}
          </Typography>
        </header>

        <div className="mt-6">
          <CreateWorkspaceForm
            lang={lang}
            initialOrganizationId={requestedOrganizationId}
            onCreateOrganization={() => navigate({
              to: '/$lang/organizations/new',
              params: { lang },
            })}
          />
        </div>
      </section>
    </main>
  )
}
