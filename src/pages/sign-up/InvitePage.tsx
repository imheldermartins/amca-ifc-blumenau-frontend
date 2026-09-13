import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { Button } from 'cubs-components'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/AuthService'
import { i18n } from '@/lib/i18n'

export function InvitePage() {
  const { lang, token } = useParams({ from: '/$lang/_public/invite/$token' })
  const { user } = useAuth()
  const navigate = useNavigate()
  const preview = useQuery({ queryKey: ['access-invite', token], queryFn: () => authService.previewInvite(token), retry: false })
  const accept = useMutation({
    mutationFn: () => authService.acceptInvite(token),
    onSuccess: () => {
      const data = preview.data
      if (!data?.scopeType || !data.scopeId) return
      const destination = data.scopeType === 'organization' ? `/${lang}/organizations/${data.scopeId}`
        : data.scopeType === 'workspace' ? `/${lang}/myworkspace/${data.scopeId}` : `/${lang}/page/${data.scopeId}`
      void navigate({ href: destination, replace: true })
    },
  })
  const returnTo = `/${lang}/invite/${token}`

  return <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-r from-p-purple-600 to-p-purple-700 px-5 py-12 text-light-100">
    <section className="w-full max-w-105">
      <Icon icon="lucide:mail-open" className="mb-6 size-10 text-p-purple-200" />
      <h1 className="text-3xl font-bold tracking-tight text-light-100 sm:text-4xl">{i18n('pages.invite.title')}</h1>
      {preview.isPending ? <p className="mt-4 text-light-300">{i18n('common.carregando')}</p>
        : !preview.data?.valid ? <p role="alert" className="mt-4 text-light-300">{i18n('pages.invite.invalid')}</p>
          : <div className="mt-6 rounded-2xl border border-light-500/40 bg-purple-800/50 p-5">
            <p className="text-sm leading-6 text-light-200">
              {i18n('pages.invite.description', { author: preview.data.authorName ?? '', scope: preview.data.scopeName ?? '', role: preview.data.roleName ?? '' })}
            </p>
            {preview.data.expiresAt && <p className="mt-3 text-xs text-light-300">{i18n('pages.invite.expires', { date: new Date(preview.data.expiresAt).toLocaleString('pt-BR') })}</p>}
            {user ? <Button type="button" variant="filled" color="from-theme" disabled={accept.isPending}
              className="mt-6 h-11 w-full rounded-xl bg-light-100 text-lg text-p-purple-600 hover:bg-light-300" onClick={() => accept.mutate()}>
              {accept.isPending ? i18n('pages.invite.accepting') : i18n('pages.invite.accept')}
            </Button> : <div className="mt-6 grid gap-3">
              <Link to="/$lang/sign-in" params={{ lang }} search={{ returnTo }} className="flex h-11 items-center justify-center rounded-xl bg-light-100 font-semibold text-p-purple-600 hover:bg-light-300">{i18n('pages.invite.sign-in')}</Link>
              <Link to="/$lang/sign-up" params={{ lang }} search={{ returnTo, invite: token }} className="flex h-11 items-center justify-center rounded-xl border border-light-500 font-semibold text-light-100 hover:bg-purple-700">{i18n('pages.invite.sign-up')}</Link>
            </div>}
            {accept.isError && <p role="alert" className="mt-4 text-sm text-p-red-300">{i18n('pages.invite.error')}</p>}
          </div>}
    </section>
  </main>
}
