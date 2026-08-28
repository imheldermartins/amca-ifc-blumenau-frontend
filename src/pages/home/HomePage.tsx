import { useNavigate, useParams } from '@tanstack/react-router'
import { Trans } from 'react-i18next'
import { Button } from 'cubs-components'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export function HomePage() {
  const { lang } = useParams({ from: '/$lang/' })
  const navigate = useNavigate()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background p-5 text-center text-foreground">
      <Typography variant="h1" className="text-5xl font-extrabold tracking-tight sm:text-7xl">
        <Trans
          i18nKey="pages.home.bem-vindo-ao-cubs"
          values={{ appName: i18n('common.app-name') }}
          components={{ green: <span className="text-p-purple-500" /> }}
        />
      </Typography>
      <Typography variant="h3" className="mt-3 max-w-md text-balance leading-tight text-dark-100 dark:text-light-900">
        {i18n('pages.home.descricao')}
      </Typography>
      <div className="mt-12 flex gap-2">
        <Button
          variant="filled"
          onClick={() => navigate({ to: '/$lang/sign-in', params: { lang } })}
        >
          {i18n('pages.home.entrar')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate({ to: '/$lang/sign-up', params: { lang } })}
        >
          {i18n('pages.home.criar-conta')}
        </Button>
      </div>
    </main>
  )
}
