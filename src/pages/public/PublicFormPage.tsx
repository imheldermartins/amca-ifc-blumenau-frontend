import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { Button, cn } from 'cubs-components'
import { FormFieldControl, type FormInputField } from 'cubs-database'

import { useFragmentCapability } from '@/hooks/useFragmentCapability'
import { formService } from '@/services/FormService'

function serialize(type: FormInputField['type'], raw: unknown): unknown {
  if (type === 'numeric') return raw === '' ? undefined : Number(raw)
  return raw
}

export function PublicFormPage({ publicationId }: { publicationId: string }) {
  const { value: capability, revision: capabilityRevision } = useFragmentCapability()
  const definition = useQuery({
    queryKey: ['public-form-definition', publicationId, capabilityRevision],
    queryFn: () => formService.definition(publicationId, capability),
    enabled: Boolean(capability),
    gcTime: 0,
    retry: false,
  })
  const methods = useForm<Record<string, unknown>>({ shouldUnregister: true })
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [callback, setCallback] = useState<string | null>(null)
  const requestId = useRef(crypto.randomUUID())

  const submit = methods.handleSubmit(async (values) => {
    if (!definition.data || status === 'submitting') return
    setStatus('submitting')
    try {
      const fields = definition.data.fields.flatMap((field) => {
        if (field.readOnly) return []
        const raw = values[field.key] ?? (field.type === 'checkbox' ? false : '')
        const value = serialize(field.type, raw)
        return value === undefined || value === '' || value === null
          ? []
          : [{ key: field.key, value }]
      })
      const result = await formService.submit(
        publicationId,
        capability,
        requestId.current,
        fields,
      )
      requestId.current = crypto.randomUUID()
      setCallback(result.callback)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  })

  if (!capability) return <PublicFormState icon="lucide:key-round" title="Chave necessária" description="Abra o link completo recebido para acessar este formulário." />
  if (definition.isPending) return <PublicFormState spinning icon="lucide:loader-circle" title="Carregando formulário" />
  if (definition.isError || !definition.data) return <PublicFormState icon="lucide:shield-x" title="Formulário indisponível" description="A chave expirou, foi revogada ou o formulário não existe mais." />

  const form = definition.data
  return <main className="min-h-screen bg-contrast px-4 py-10 text-foreground">
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-p-purple/15 text-p-purple">
          <Icon icon="lucide:clipboard-list" className="size-6" />
        </div>
        <p className="text-sm opacity-60">{form.title ?? 'Cub’s'}</p>
        <h1 className="text-2xl font-semibold">{form.name}</h1>
      </header>
      <FormProvider {...methods}>
        <form onSubmit={(event) => { void submit(event) }} className="grid gap-5">
          {form.fields.map((field) => <FormFieldControl
            key={field.key}
            name={field.key}
            disabled={field.readOnly || status === 'submitting'}
            field={{
              id: field.key,
              label: field.label,
              type: field.type,
              ...(field.mask && { mask: field.mask }),
              ...(field.options && {
                options: field.options.map((option) => ({
                  value: option.key,
                  label: option.label,
                })),
              }),
            }}
          />)}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p role="status" className={cn('text-sm', status === 'error' && 'text-p-red', status === 'success' && 'text-p-green')}>
              {status === 'success' ? callback || 'Resposta enviada com sucesso.' : status === 'error' ? 'Não foi possível enviar. Tente novamente.' : ''}
            </p>
            <Button type="submit" disabled={status === 'submitting'}>
              {status === 'submitting'
                ? <Icon icon="lucide:loader-circle" className="size-4 animate-spin" />
                : form.submitButton.icon ? <Icon icon={form.submitButton.icon} className="size-4" /> : null}
              {form.submitButton.label}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  </main>
}

function PublicFormState({ icon, title, description, spinning }: { icon: string; title: string; description?: string; spinning?: boolean }) {
  return <main className="flex min-h-screen items-center justify-center bg-contrast p-6 text-foreground">
    <div className="max-w-md rounded-2xl border border-divider bg-background p-7 text-center shadow-sm">
      <Icon icon={icon} className={cn('mx-auto mb-3 size-8 text-p-purple', spinning && 'animate-spin')} />
      <h1 className="text-lg font-semibold">{title}</h1>
      {description && <p className="mt-2 text-sm opacity-60">{description}</p>}
    </div>
  </main>
}
