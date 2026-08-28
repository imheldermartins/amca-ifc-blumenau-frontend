import { FormProvider, useForm } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Button, PALETTE, TextField, cn } from 'cubs-components'

import { Typography } from '@components/Typography'
import { useAuth } from '@contexts/AuthContext'
import { DEFAULT_WORKSPACE_ID } from '@/contexts/WorkspaceContext'
import { i18n } from '@/lib/i18n'
import { combineRules, validators } from '@/lib/validators'
import { EmailInUseError } from '@/services/AuthService'

interface SignUpFormValues {
  name: string
  email: string
  password: string
}

export function SignUpPage() {
  const { lang } = useParams({ from: '/$lang/_public/sign-up' })
  const navigate = useNavigate()
  const auth = useAuth()

  const form = useForm<SignUpFormValues>({
    mode: 'onTouched',
    defaultValues: { name: '', email: '', password: '' },
  })

  const signUp = useMutation({
    mutationFn: (values: SignUpFormValues) => auth.signUp(values),
    onSuccess: () =>
      navigate({
        to: '/$lang/myworkspace/$workspaceId',
        params: { lang, workspaceId: DEFAULT_WORKSPACE_ID },
      }),
  })

  const serverError = signUp.isError
    ? signUp.error instanceof EmailInUseError
      ? i18n('pages.sign-up.erro-email-em-uso')
      : i18n('pages.sign-up.erro-generico')
    : null

  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-sm rounded-2xl border border-divider-contrast bg-glass p-5 shadow-2xl shadow-black/15 backdrop-blur-xl">
        <Typography variant="h2" as="h1">
          {i18n('pages.sign-up.crie-sua-conta')}
        </Typography>
        <Typography variant="subtitle" className="mt-1">
          {i18n('pages.sign-up.subtitulo')}
        </Typography>

        <FormProvider {...form}>
          <form
            className="mt-5 flex flex-col gap-3"
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
            />
            <TextField
              name="email"
              label={i18n('pages.sign-up.campo-email')}
              type="email"
              autoComplete="email"
              placeholder={i18n('pages.sign-up.campo-email-placeholder')}
              rules={combineRules(validators.required(), validators.email())}
            />
            <TextField
              name="password"
              label={i18n('pages.sign-up.campo-senha')}
              type="password"
              autoComplete="new-password"
              placeholder={i18n('pages.sign-up.campo-senha-placeholder')}
              rules={combineRules(validators.required(), validators.minLength(6))}
            />

            {serverError && (
              <Typography variant="body" className={PALETTE.red.text}>
                {serverError}
              </Typography>
            )}

            <Button type="submit" variant="filled" color="purple" disabled={signUp.isPending}>
              {signUp.isPending
                ? i18n('pages.sign-up.criando-conta')
                : i18n('pages.sign-up.botao-criar-conta')}
            </Button>
          </form>
        </FormProvider>

        <Typography variant="subtitle" className="mt-5 text-center">
          {i18n('pages.sign-up.ja-tem-conta')}{' '}
          <Link
            to="/$lang/sign-in"
            params={{ lang }}
            className={cn('font-medium hover:underline', PALETTE.purple.text)}
          >
            {i18n('pages.sign-up.link-entrar')}
          </Link>
        </Typography>
      </div>
    </main>
  )
}
