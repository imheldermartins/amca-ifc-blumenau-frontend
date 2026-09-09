import { Icon } from '@iconify/react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Button } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { i18n } from '@/lib/i18n'

export function AccessDeniedPage() {
  const { lang } = useParams({ strict: false })
  const navigate = useNavigate()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
      <section className="max-w-md text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-p-red-600/15 text-p-red">
          <Icon icon="lucide:shield-x" className="size-7" />
        </span>
        <Typography variant="h1" className="mt-5">{i18n('pages.workspaces.denied.title')}</Typography>
        <Typography variant="body" as="p" className="mt-2 text-dark-100 dark:text-light-900">
          {i18n('pages.workspaces.denied.description')}
        </Typography>
        <Button
          type="button"
          variant="filled"
          color="purple"
          className="mt-6"
        onClick={() => navigate({ to: '/$lang/workspaces', params: { lang: lang ?? 'pt-br' }, search: { choose: true, tab: 'workspaces' } })}
        >
          {i18n('pages.workspaces.denied.back')}
        </Button>
      </section>
    </main>
  )
}
