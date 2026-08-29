import { FormProvider, useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Icon } from '@iconify/react'
import { Button, TextField } from 'cubs-components'
import { useAuth } from '@contexts/AuthContext'
import { DEFAULT_WORKSPACE_ID } from '@/contexts/WorkspaceContext'
import { i18n } from '@/lib/i18n'
import { combineRules, validators } from '@/lib/validators'
import { InvalidCredentialsError } from '@/services/AuthService'

interface SignInFormValues {
  email: string
  password: string
}

export function SignInPage() {
  const { lang } = useParams({ from: '/$lang/_public/sign-in' })
  const navigate = useNavigate()
  const auth = useAuth()

  const form = useForm<SignInFormValues>({
    mode: 'onTouched',
    defaultValues: { email: '', password: '' },
  })

  const signIn = useMutation({
    mutationFn: (values: SignInFormValues) => auth.signIn(values),
    onSuccess: () =>
      navigate({
        to: '/$lang/myworkspace/$workspaceId',
        params: { lang, workspaceId: DEFAULT_WORKSPACE_ID },
      }),
  })

  const serverError = signIn.isError
    ? signIn.error instanceof InvalidCredentialsError
      ? i18n('pages.sign-in.erro-credenciais-invalidas')
      : i18n('pages.sign-in.erro-generico')
    : null

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-linear-to-r from-p-purple-600 to-p-purple-700 px-5 py-12 text-light-100">
      <section className="w-full max-w-105">
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-light-100 sm:text-4xl">
            {i18n('pages.sign-in.entre-seja-bem-vindo')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-light-300">
            {i18n('pages.sign-in.subtitulo')}
          </p>
        </header>

        <div className="mt-8">
          <FormProvider {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit((values) => signIn.mutate(values))}
              noValidate
            >
              <TextField
                name="email"
                label={i18n('pages.sign-in.campo-email')}
                type="email"
                autoComplete="email"
                placeholder={i18n('pages.sign-in.campo-email-placeholder')}
                rules={combineRules(validators.required(), validators.email())}
                startAdornment={<Icon icon="lucide:mail" className="size-4 text-dark-100" />}
                className="gap-1.5 text-light-100"
                inputClassName="h-11 rounded-xl border-light-500 bg-light-100 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-300 focus-visible:ring-p-purple-200/60"
                errorClassName="text-p-red-300"
                errorInputClassName="border-p-red-300 focus-visible:border-p-red-300 focus-visible:ring-p-red-300/30"
              />
              <TextField
                name="password"
                label={i18n('pages.sign-in.campo-senha')}
                type="password"
                autoComplete="current-password"
                placeholder={i18n('pages.sign-in.campo-senha-placeholder')}
                rules={validators.required()}
                startAdornment={<Icon icon="lucide:lock-keyhole" className="size-4 text-dark-100" />}
                className="gap-1.5 text-light-100"
                inputClassName="h-11 rounded-xl border-light-500 bg-light-100 text-dark-700 placeholder:text-light-900 focus-visible:border-p-purple-300 focus-visible:ring-p-purple-200/60"
                errorClassName="text-p-red-300"
                errorInputClassName="border-p-red-300 focus-visible:border-p-red-300 focus-visible:ring-p-red-300/30"
              />

              {serverError && (
                <p role="alert" className="text-sm text-p-red-300">
                  {serverError}
                </p>
              )}

              <Button
                type="submit"
                variant="filled"
                color="from-theme"
                disabled={signIn.isPending}
                className="mt-1 h-11 w-full rounded-xl bg-light-100 text-lg text-p-purple-600 shadow-p-purple-900/20 hover:bg-light-300"
              >
                {signIn.isPending
                  ? i18n('pages.sign-in.entrando')
                  : i18n('pages.sign-in.botao-entrar')}
              </Button>
            </form>
          </FormProvider>
        </div>
        <div className="mt-7 text-center text-sm text-light-300">
          <>
            {i18n('pages.sign-in.nao-tem-conta')}{' '}
            <Link
              to="/$lang/sign-up"
              params={{ lang }}
              className="font-semibold text-light-100 hover:underline"
            >
              {i18n('pages.sign-in.link-criar-conta')}
            </Link>
          </>
        </div>
      </section>
    </main>
  )
}
