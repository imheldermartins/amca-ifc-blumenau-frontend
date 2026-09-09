import { FormProvider, useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { Button, TextField } from 'cubs-components'

import { useAuth } from '@contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import { combineRules, validators } from '@/lib/validators'
import { EmailInUseError } from '@/services/AuthService'

interface SignUpFormValues {
  name: string
  email: string
  password: string
  confirmPassword: string
}

export function SignUpPage() {
  const { lang } = useParams({ from: '/$lang/_public/sign-up' })
  const navigate = useNavigate()
  const auth = useAuth()

  const form = useForm<SignUpFormValues>({
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const signUp = useMutation({
    mutationFn: (values: SignUpFormValues) =>
      auth.signUp({ name: values.name, email: values.email, password: values.password }),
    onSuccess: ({ workspace }) =>
      navigate({
        to: '/$lang/myworkspace/$workspaceId',
        params: { lang, workspaceId: workspace.id },
        replace: true,
      }),
  })

  const serverError = signUp.isError
    ? signUp.error instanceof EmailInUseError
      ? i18n('pages.sign-up.erro-email-em-uso')
      : i18n('pages.sign-up.erro-generico')
    : null

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-light-100 px-5 py-12 text-dark-700">
      <section className="w-full max-w-105">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-dark-900 sm:text-4xl">
            {i18n('pages.sign-up.crie-sua-conta')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-dark-100">
            {i18n('pages.sign-up.subtitulo')}
          </p>
        </header>

        <div className="mt-8">
          <FormProvider {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit((values) => signUp.mutate(values))}
              noValidate
            >
              <TextField
                name="name"
                label={i18n('pages.sign-up.campo-nome')}
                type="text"
                autoComplete="name"
                placeholder={i18n('pages.sign-up.campo-nome-placeholder')}
                rules={validators.required()}
                startAdornment={<Icon icon="lucide:user-round" className="size-4 text-light-900" />}
                className="gap-1.5 text-dark-100"
                inputClassName="h-11 rounded-xl border-light-300 bg-light-200 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-400 focus-visible:ring-p-purple-200"
                errorClassName="text-p-red-600"
                errorInputClassName="border-p-red-600 focus-visible:border-p-red-600 focus-visible:ring-p-red-300/30"
              />
              <TextField
                name="email"
                label={i18n('pages.sign-up.campo-email')}
                type="email"
                autoComplete="email"
                placeholder={i18n('pages.sign-up.campo-email-placeholder')}
                rules={combineRules(validators.required(), validators.email())}
                startAdornment={<Icon icon="lucide:mail" className="size-4 text-light-900" />}
                className="gap-1.5 text-dark-100"
                inputClassName="h-11 rounded-xl border-light-300 bg-light-200 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-400 focus-visible:ring-p-purple-200"
                errorClassName="text-p-red-600"
                errorInputClassName="border-p-red-600 focus-visible:border-p-red-600 focus-visible:ring-p-red-300/30"
              />
              <TextField
                name="password"
                label={i18n('pages.sign-up.campo-senha')}
                type="password"
                autoComplete="new-password"
                placeholder={i18n('pages.sign-up.campo-senha-placeholder')}
                rules={combineRules(validators.required(), validators.minLength(6))}
                startAdornment={<Icon icon="lucide:lock-keyhole" className="size-4 text-light-900" />}
                className="gap-1.5 text-dark-100"
                inputClassName="h-11 rounded-xl border-light-300 bg-light-200 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-400 focus-visible:ring-p-purple-200"
                errorClassName="text-p-red-600"
                errorInputClassName="border-p-red-600 focus-visible:border-p-red-600 focus-visible:ring-p-red-300/30"
              />
              <TextField
                name="confirmPassword"
                label={i18n('pages.sign-up.campo-confirmar-senha')}
                type="password"
                autoComplete="new-password"
                placeholder={i18n('pages.sign-up.campo-confirmar-senha-placeholder')}
                rules={combineRules(validators.required(), {
                  deps: ['password'],
                  validate: {
                    passwordMatch: (value) =>
                      value === form.getValues('password') ||
                      i18n('validation.senhas-nao-coincidem'),
                  },
                })}
                startAdornment={<Icon icon="lucide:lock-keyhole" className="size-4 text-light-900" />}
                className="gap-1.5 text-dark-100"
                inputClassName="h-11 rounded-xl border-light-300 bg-light-200 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-400 focus-visible:ring-p-purple-200"
                errorClassName="text-p-red-600"
                errorInputClassName="border-p-red-600 focus-visible:border-p-red-600 focus-visible:ring-p-red-300/30"
              />

              {serverError && (
                <p role="alert" className="text-sm text-p-red-600">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                variant="filled"
                color="purple"
                disabled={signUp.isPending}
                className="mt-1 h-11 w-full rounded-xl"
              >
                {signUp.isPending
                  ? i18n('pages.sign-up.criando-conta')
                  : i18n('pages.sign-up.botao-criar-conta')}
              </Button>
            </form>
          </FormProvider>
        </div>
        <div className="mt-7 text-center text-sm text-dark-100">
          <>
            {i18n('pages.sign-up.ja-tem-conta')}{' '}
            <Link
              to="/$lang/sign-in"
              params={{ lang }}
              className="font-semibold text-p-purple-600 hover:underline"
            >
              {i18n('pages.sign-up.link-entrar')}
            </Link>
          </>
        </div>
      </section>
    </main>
  )
}
