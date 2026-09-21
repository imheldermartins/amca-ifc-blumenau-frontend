import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { Button, TextField } from 'cubs-components'
import { useAuth } from '@contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { readAuthReturnTo } from '@/lib/authReturnTo'
import { i18n } from '@/lib/i18n'
import { combineRules, validators } from '@/lib/validators'
import { authService, EmailInUseError } from '@/services/AuthService'

interface SignUpFormValues { name: string; email: string }

export function SignUpPage() {
  const { slug: lang } = useLanguage()
  const auth = useAuth()
  const query = useQueryParams<'returnTo' | 'invite'>()
  const returnTo = readAuthReturnTo(query.get('returnTo'))
  const inviteToken = query.get('invite')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [deliveryPending, setDeliveryPending] = useState(false)
  const [retryIn, setRetryIn] = useState(60)
  const form = useForm<SignUpFormValues>({ mode: 'onTouched', defaultValues: { name: '', email: '' } })
  const signUp = useMutation({
    mutationFn: (values: SignUpFormValues) => auth.signUp({
      ...values,
      ...(inviteToken ? { inviteToken } : {}),
      ...(returnTo ? { returnTo } : {}),
    }),
    onSuccess: (result) => { setSentTo(result.email); setDeliveryPending(result.notificationPending); setRetryIn(60) },
  })
  const resend = useMutation({
    mutationFn: () => authService.resendVerification(sentTo!),
    onSuccess: (result) => { setDeliveryPending(result.notificationPending); setRetryIn(60) },
  })
  useEffect(() => {
    if (!sentTo || retryIn <= 0) return
    const timer = window.setTimeout(() => setRetryIn((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [sentTo, retryIn])

  const serverError = signUp.isError
    ? signUp.error instanceof EmailInUseError ? i18n('pages.sign-up.erro-email-em-uso') : i18n('pages.sign-up.erro-generico')
    : null

  return <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-light-100 px-5 py-12 text-dark-700">
    <section className="w-full max-w-105">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-dark-900 sm:text-4xl">
          {sentTo ? i18n('pages.sign-up.verifique-email') : i18n('pages.sign-up.crie-sua-conta')}
        </h1>
        <p className="mt-2 text-sm leading-6 text-dark-100">
          {sentTo ? i18n('pages.sign-up.verifique-email-descricao', { email: sentTo }) : i18n('pages.sign-up.subtitulo')}
        </p>
      </header>

      {sentTo ? <div className="mt-8 rounded-2xl border border-light-300 bg-light-200 p-5">
        <Icon icon="lucide:mail-check" className="mb-4 size-8 text-p-purple-600" />
        <p className="text-sm leading-6 text-dark-100">{i18n('pages.sign-up.verifique-email-ajuda')}</p>
        {deliveryPending&&<p role="status" className="mt-3 text-sm text-p-orange-600">{i18n('pages.sign-up.entrega-pendente')}</p>}
        <Button className="mt-5 w-full" variant="outlined" color="purple" disabled={retryIn > 0 || resend.isPending} onClick={() => resend.mutate()}>
          {retryIn > 0 ? i18n('pages.sign-up.reenviar-em', { seconds: retryIn }) : i18n('pages.sign-up.reenviar')}
        </Button>
        {resend.isError && <p role="alert" className="mt-3 text-sm text-p-red-600">{i18n('pages.sign-up.erro-generico')}</p>}
      </div> : <div className="mt-8">
        <FormProvider {...form}><form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => signUp.mutate(values))} noValidate>
          <TextField name="name" label={i18n('pages.sign-up.campo-nome')} type="text" autoComplete="name"
            placeholder={i18n('pages.sign-up.campo-nome-placeholder')} rules={validators.required()}
            startAdornment={<Icon icon="lucide:user-round" className="size-4 text-light-900" />}
            className="gap-1.5 text-dark-100" inputClassName="h-11 rounded-xl border-light-300 bg-light-200 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-400 focus-visible:ring-p-purple-200"
            errorClassName="text-p-red-600" errorInputClassName="border-p-red-600 focus-visible:border-p-red-600 focus-visible:ring-p-red-300/30" />
          <TextField name="email" label={i18n('pages.sign-up.campo-email')} type="email" autoComplete="email"
            placeholder={i18n('pages.sign-up.campo-email-placeholder')} rules={combineRules(validators.required(), validators.email())}
            startAdornment={<Icon icon="lucide:mail" className="size-4 text-light-900" />}
            className="gap-1.5 text-dark-100" inputClassName="h-11 rounded-xl border-light-300 bg-light-200 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-400 focus-visible:ring-p-purple-200"
            errorClassName="text-p-red-600" errorInputClassName="border-p-red-600 focus-visible:border-p-red-600 focus-visible:ring-p-red-300/30" />
          {serverError && <p role="alert" className="text-sm text-p-red-600">{serverError}</p>}
          <Button type="submit" variant="filled" color="purple" disabled={signUp.isPending} className="mt-1 h-11 w-full rounded-xl">
            {signUp.isPending ? i18n('pages.sign-up.enviando-validacao') : i18n('pages.sign-up.botao-continuar')}
          </Button>
        </form></FormProvider>
      </div>}
      <div className="mt-7 text-center text-sm text-dark-100">
        {i18n('pages.sign-up.ja-tem-conta')}{' '}
        <Link to="/$lang/sign-in" params={{ lang }} search={{ returnTo }} className="font-semibold text-p-purple-600 hover:underline">
          {i18n('pages.sign-up.link-entrar')}
        </Link>
      </div>
    </section>
  </main>
}
