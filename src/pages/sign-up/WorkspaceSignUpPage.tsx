import { useState, type FormEvent } from 'react'
import { Icon } from '@iconify/react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, TextField, cn } from 'cubs-components'

import { useAuth } from '@/contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import { combineRules, validators } from '@/lib/validators'
import { authService, EmailInUseError } from '@/services/AuthService'

interface WorkspaceSignUpValues {
  key: string
  name: string
  email: string
  password: string
  confirmPassword: string
  workspaceName: string
}

type Step = 'key' | 'account' | 'workspace'

const STEPS: Step[] = ['key', 'account', 'workspace']

function workspaceNameFor(name: string): string {
  const firstName = name.trim().split(/\s+/)[0]
  return firstName
    ? i18n('pages.workspace-sign-up.workspace.default-name', { firstName })
    : ''
}

export function WorkspaceSignUpPage() {
  const { lang } = useParams({ from: '/$lang/_public/create-workspaces' })
  const navigate = useNavigate()
  const auth = useAuth()
  const [step, setStep] = useState<Step>('key')

  const form = useForm<WorkspaceSignUpValues>({
    mode: 'onTouched',
    defaultValues: {
      key: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      workspaceName: '',
    },
  })

  const preview = useMutation({
    mutationFn: ({ key }: Pick<WorkspaceSignUpValues, 'key'>) =>
      authService.previewWorkspaceKey(key),
    onSuccess: (result) => {
      if (!result.valid) {
        form.setError('key', {
          type: 'server',
          message: i18n('pages.workspace-sign-up.key.invalid'),
        })
        return
      }

      form.setValue('name', result.name)
      form.setValue('email', result.email)
      form.clearErrors(['key', 'name', 'email'])
      setStep('account')
    },
    onError: () => {
      form.setError('key', {
        type: 'server',
        message: i18n('pages.workspace-sign-up.key.error'),
      })
    },
  })

  const registration = useMutation({
    mutationFn: (values: WorkspaceSignUpValues) =>
      auth.signUpWithWorkspace({
        key: values.key,
        name: values.name,
        email: values.email,
        password: values.password,
        workspaceName: values.workspaceName,
      }),
    onSuccess: ({ workspace }) =>
      navigate({
        to: '/$lang/myworkspace/$workspaceId',
        params: { lang, workspaceId: workspace.id },
        replace: true,
      }),
  })

  const registrationError = registration.isError
    ? registration.error instanceof EmailInUseError
      ? i18n('pages.sign-up.erro-email-em-uso')
      : i18n('pages.workspace-sign-up.finish.error')
    : null

  const goToWorkspace = async () => {
    const accountIsValid = await form.trigger([
      'name',
      'email',
      'password',
      'confirmPassword',
    ])
    if (!accountIsValid) return

    if (!form.getValues('workspaceName').trim()) {
      form.setValue('workspaceName', workspaceNameFor(form.getValues('name')))
    }
    setStep('workspace')
  }

  const submitRegistration = form.handleSubmit((values) => {
    registration.mutate(values)
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 'key') {
      void form.trigger('key').then((keyIsValid) => {
        if (keyIsValid) preview.mutate({ key: form.getValues('key') })
      })
      return
    }
    if (step === 'account') {
      void goToWorkspace()
      return
    }
    void submitRegistration()
  }

  const currentStepIndex = STEPS.indexOf(step)

  return (
    <main className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-light-100 px-5 py-12 text-dark-700">
      <section className="w-full max-w-xl">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-dark-900 sm:text-4xl">
            {i18n('pages.workspace-sign-up.title')}
          </h1>
          <p className="mt-2 text-sm leading-6 text-dark-100">
            {i18n('pages.workspace-sign-up.subtitle')}
          </p>
        </header>

        <ol
          aria-label={i18n('pages.workspace-sign-up.steps.label')}
          className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-2"
        >
          {STEPS.map((candidate, index) => (
            <li
              key={candidate}
              aria-current={candidate === step ? 'step' : undefined}
              className="text-center"
            >
              <span
                className={cn(
                  'mx-auto flex size-8 items-center justify-center rounded-full border text-sm font-semibold',
                  index <= currentStepIndex
                    ? 'border-p-purple-600 bg-p-purple-600 text-light-100'
                    : 'border-light-500 bg-light-200 text-dark-100',
                )}
              >
                {index + 1}
              </span>
              <span className="mt-1 block text-xs text-dark-100">
                {i18n(`pages.workspace-sign-up.steps.${candidate}`)}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-2xl border border-light-500 bg-light-200 p-6 shadow-xl shadow-dark-900/5 sm:p-8">
          <FormProvider {...form}>
            <form className="flex flex-col gap-4" noValidate onSubmit={submit}>
              {step === 'key' && (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-dark-900">
                      {i18n('pages.workspace-sign-up.key.title')}
                    </h2>
                    <p className="mt-1 text-sm text-dark-100">
                      {i18n('pages.workspace-sign-up.key.description')}
                    </p>
                  </div>
                  <TextField
                    name="key"
                    label={i18n('pages.workspace-sign-up.key.field')}
                    placeholder={i18n('pages.workspace-sign-up.key.placeholder')}
                    rules={validators.required()}
                    autoComplete="off"
                    spellCheck={false}
                    startAdornment={<Icon icon="lucide:key-round" className="size-4 text-light-900" />}
                    onChange={() => {
                      preview.reset()
                      form.clearErrors('key')
                    }}
                  />
                  <Button
                    type="submit"
                    variant="filled"
                    color="purple"
                    disabled={preview.isPending}
                    className="mt-1 h-11 w-full rounded-xl"
                  >
                    {i18n(preview.isPending
                      ? 'pages.workspace-sign-up.key.validating'
                      : 'pages.workspace-sign-up.key.continue')}
                  </Button>
                </>
              )}

              {step === 'account' && (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-dark-900">
                      {i18n('pages.workspace-sign-up.account.title')}
                    </h2>
                    <p className="mt-1 text-sm text-dark-100">
                      {i18n('pages.workspace-sign-up.account.description')}
                    </p>
                  </div>
                  <TextField
                    name="name"
                    label={i18n('pages.sign-up.campo-nome')}
                    type="text"
                    autoComplete="name"
                    placeholder={i18n('pages.sign-up.campo-nome-placeholder')}
                    rules={validators.required()}
                    startAdornment={<Icon icon="lucide:user-round" className="size-4 text-light-900" />}
                  />
                  <TextField
                    name="email"
                    label={i18n('pages.sign-up.campo-email')}
                    type="email"
                    autoComplete="email"
                    placeholder={i18n('pages.sign-up.campo-email-placeholder')}
                    rules={combineRules(validators.required(), validators.email())}
                    startAdornment={<Icon icon="lucide:mail" className="size-4 text-light-900" />}
                  />
                  <TextField
                    name="password"
                    label={i18n('pages.sign-up.campo-senha')}
                    type="password"
                    autoComplete="new-password"
                    placeholder={i18n('pages.sign-up.campo-senha-placeholder')}
                    rules={combineRules(validators.required(), validators.minLength(6))}
                    startAdornment={<Icon icon="lucide:lock-keyhole" className="size-4 text-light-900" />}
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
                  />
                  <div className="mt-1 flex gap-2">
                    <Button
                      type="button"
                      variant="outlined"
                      color="purple"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => setStep('key')}
                    >
                      {i18n('pages.workspace-sign-up.back')}
                    </Button>
                    <Button
                      type="button"
                      variant="filled"
                      color="purple"
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => void goToWorkspace()}
                    >
                      {i18n('pages.workspace-sign-up.account.continue')}
                    </Button>
                  </div>
                </>
              )}

              {step === 'workspace' && (
                <>
                  <div>
                    <h2 className="text-lg font-bold text-dark-900">
                      {i18n('pages.workspace-sign-up.workspace.title')}
                    </h2>
                    <p className="mt-1 text-sm text-dark-100">
                      {i18n('pages.workspace-sign-up.workspace.description')}
                    </p>
                  </div>
                  <TextField
                    name="workspaceName"
                    label={i18n('pages.workspace-sign-up.workspace.field')}
                    type="text"
                    autoComplete="organization"
                    placeholder={i18n('pages.workspace-sign-up.workspace.placeholder')}
                    rules={validators.required()}
                    maxLength={120}
                    startAdornment={<Icon icon="lucide:boxes" className="size-4 text-light-900" />}
                  />

                  {registrationError && (
                    <p role="alert" className="text-sm text-p-red-600">
                      {registrationError}
                    </p>
                  )}

                  <div className="mt-1 flex gap-2">
                    <Button
                      type="button"
                      variant="outlined"
                      color="purple"
                      disabled={registration.isPending}
                      className="h-11 flex-1 rounded-xl"
                      onClick={() => setStep('account')}
                    >
                      {i18n('pages.workspace-sign-up.back')}
                    </Button>
                    <Button
                      type="submit"
                      variant="filled"
                      color="purple"
                      disabled={registration.isPending}
                      className="h-11 flex-1 rounded-xl"
                    >
                      {i18n(registration.isPending
                        ? 'pages.workspace-sign-up.finish.creating'
                        : 'pages.workspace-sign-up.finish.create')}
                    </Button>
                  </div>
                </>
              )}
            </form>
          </FormProvider>
        </div>

        <p className="mt-7 text-center text-sm text-dark-100">
          {i18n('pages.workspace-sign-up.has-account')}{' '}
          <Link
            to="/$lang/sign-in"
            params={{ lang }}
            className="font-semibold text-p-purple-600 hover:underline"
          >
            {i18n('pages.workspace-sign-up.sign-in')}
          </Link>
        </p>
      </section>
    </main>
  )
}
