import { useEffect } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { Button, TextField } from 'cubs-components'
import { useAuth } from '@/contexts/AuthContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useQueryParams } from '@/hooks/useQueryParams'
import { authService } from '@/services/AuthService'
import { readAuthReturnTo } from '@/lib/authReturnTo'
import { combineRules, validators } from '@/lib/validators'
import { i18n } from '@/lib/i18n'

interface PasswordForm { name: string; password: string; confirmPassword: string }

export function VerifyEmailPage({ token }: { token: string }) {
  const { slug: lang } = useLanguage()
  const navigate = useNavigate()
  const auth = useAuth()
  const returnTo = readAuthReturnTo(useQueryParams<'returnTo'>().get('returnTo'))
  const preview = useQuery({ queryKey: ['email-verification', token], queryFn: () => authService.previewVerification(token), retry: false })
  const form = useForm<PasswordForm>({ mode: 'onTouched', defaultValues: { name: '', password: '', confirmPassword: '' } })
  useEffect(() => { if (preview.data?.name) form.setValue('name', preview.data.name) }, [preview.data?.name, form])
  const complete = useMutation({
    mutationFn: (values: PasswordForm) => auth.completeVerification(token, {
      name: values.name,
      password: values.password,
    }),
    onSuccess: (result) => {
      const invite = preview.data?.invite
      const destination = result.inviteAccepted && invite
        ? invite.scopeType === 'organization' ? `/${lang}/organizations/${invite.scopeId}`
          : invite.scopeType === 'workspace' ? `/${lang}/workspace/${invite.scopeId}`
            : `/${lang}/page/${invite.scopeId}`
        : returnTo ?? `/${lang}/workspace/${result.workspace.id}`
      void navigate({ href: destination, replace: true })
    },
  })

  return <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-r from-p-purple-600 to-p-purple-700 px-5 py-12 text-light-100">
    <section className="w-full max-w-105">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-light-100 sm:text-4xl">{i18n('pages.verify-email.title')}</h1>
        <p className="mt-2 text-sm leading-6 text-light-300">
          {preview.data?.valid ? i18n('pages.verify-email.subtitle', { email: preview.data.email ?? '' }) : i18n('pages.verify-email.loading')}
        </p>
      </header>
      {preview.isPending ? <Icon icon="lucide:loader-circle" className="mt-8 size-6 animate-spin text-p-purple-200" />
        : !preview.data?.valid ? <div className="mt-8 rounded-xl border border-light-500/40 bg-purple-800/50 p-5">
          <p role="alert" className="text-sm text-light-200">{i18n('pages.verify-email.invalid')}</p>
        </div>
          : <div className="mt-8">
            {preview.data.invite && <p className="mb-5 rounded-xl border border-light-500/40 bg-purple-800/50 p-4 text-sm leading-6 text-light-200">
              {i18n('pages.verify-email.invite', { author: preview.data.invite.authorName, scope: preview.data.invite.scopeName, role: preview.data.invite.roleName })}
            </p>}
            <FormProvider {...form}><form className="flex flex-col gap-4" onSubmit={form.handleSubmit((values) => complete.mutate(values))} noValidate>
              {!preview.data.name && <TextField name="name" label={i18n('pages.sign-up.campo-nome')} autoComplete="name" rules={validators.required()}
                startAdornment={<Icon icon="lucide:user-round" className="size-4 text-p-purple-300" />}
                className="gap-1.5 text-light-100" inputClassName="h-11 !bg-purple-800 rounded-xl border-light-500 placeholder:text-p-purple-300 focus-visible:border-p-purple-300 focus-visible:ring-p-purple-200/60"
                errorClassName="text-p-red-300" errorInputClassName="border-p-red-300 focus-visible:border-p-red-300 focus-visible:ring-p-red-300/30" />}
              <TextField name="password" label={i18n('pages.sign-up.campo-senha')} type="password" autoComplete="new-password"
                placeholder={i18n('pages.sign-up.campo-senha-placeholder')} rules={combineRules(validators.required(), validators.minLength(6))}
                startAdornment={<Icon icon="lucide:lock-keyhole" className="size-4 text-p-purple-300" />}
                className="gap-1.5 text-light-100" inputClassName="h-11 !bg-purple-800 rounded-xl border-light-500 placeholder:text-p-purple-300 focus-visible:border-p-purple-300 focus-visible:ring-p-purple-200/60"
                errorClassName="text-p-red-300" errorInputClassName="border-p-red-300 focus-visible:border-p-red-300 focus-visible:ring-p-red-300/30" />
              <TextField name="confirmPassword" label={i18n('pages.sign-up.campo-confirmar-senha')} type="password" autoComplete="new-password"
                placeholder={i18n('pages.sign-up.campo-confirmar-senha-placeholder')}
                rules={combineRules(validators.required(), { deps: ['password'], validate: { passwordMatch: (value) => value === form.getValues('password') || i18n('validation.senhas-nao-coincidem') } })}
                startAdornment={<Icon icon="lucide:lock-keyhole" className="size-4 text-p-purple-300" />}
                className="gap-1.5 text-light-100" inputClassName="h-11 !bg-purple-800 rounded-xl border-light-500 placeholder:text-p-purple-300 focus-visible:border-p-purple-300 focus-visible:ring-p-purple-200/60"
                errorClassName="text-p-red-300" errorInputClassName="border-p-red-300 focus-visible:border-p-red-300 focus-visible:ring-p-red-300/30" />
              {complete.isError && <p role="alert" className="text-sm text-p-red-300">{i18n('pages.verify-email.error')}</p>}
              <Button type="submit" variant="filled" color="from-theme" disabled={complete.isPending}
                className="mt-1 h-11 w-full rounded-xl bg-light-100 text-lg text-p-purple-600 shadow-p-purple-900/20 hover:bg-light-300">
                {complete.isPending ? i18n('pages.verify-email.activating') : i18n('pages.verify-email.activate')}
              </Button>
            </form></FormProvider>
          </div>}
    </section>
  </main>
}
