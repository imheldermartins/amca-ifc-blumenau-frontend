import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { Link, useNavigate } from '@tanstack/react-router'
import { Trans } from 'react-i18next'
import { Button } from 'cubs-components'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export function HomePage() {
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <main className="flex min-h-dvh bg-light-100">
      <section className="flex-1 flex flex-col justify-center p-6">
        <img src="/cubs.png" alt="Cub's Logo" className="w-32 h-32" />
        <Typography variant="h1" className="text-dark-900 text-8xl font-extrabold tracking-tighter">
          <Trans
            i18nKey="pages.home.bem-vindo-ao-cubs"
            values={{ appName: i18n('common.app-name') }}
            components={{ green: <span className="text-p-purple-600" /> }}
          />
        </Typography>
        <Typography variant="h3" className="mt-3 max-w-md text-balance leading-tight tracking-wide text-dark-400">
          {i18n('pages.home.descricao')}
        </Typography>
      </section>
      <section className="flex-1 flex flex-col gap-3 justify-center items-center">
        <div className="w-3/5 flex flex-row gap-3 mr-6 bg-light-300 p-2 rounded-full">
          <Link to={`/$lang/sign-up`} params={{ lang }} className='flex items-center justify-center gap-4 w-3/5 px-4 py-2 font-semibold bg-light-200 text-dark-200 rounded-full focus:border-2 focus:border-p-purple-300 focus:outline-none underline-offset-4 hover:underline'>
            {i18n('pages.home.criar-conta')}
            </Link>
          <Link to={`/$lang/sign-in`} params={{ lang }} className='flex items-center justify-center gap-4 w-3/5 px-4 py-2 font-semibold bg-light-200 text-dark-200 rounded-full focus:border-2 focus:border-p-purple-300 focus:outline-none underline-offset-4 hover:underline'>
            {i18n('pages.home.entrar-conta')}
          </Link>
        </div>

        <Typography as={'span'} variant='body' className="text-dark-400">
          {i18n('pages.home.ou')}
        </Typography>

        <Button
            variant="filled"
            color="purple"
            className="w-3/5 py-2 rounded-full text-lg"
            onClick={() => user
              ? navigate({ to: '/$lang/organizations/new', params: { lang } })
              : navigate({ to: '/$lang/sign-up', params: { lang }, search: { returnTo: `/${lang}/organizations/new` } })}
          >
            {i18n('organization.create')}
          </Button>
      </section>
    </main>
  )
}
