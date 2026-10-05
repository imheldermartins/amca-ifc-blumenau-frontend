import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from 'cubs-components'

import { useFragmentCapability } from '@/hooks/useFragmentCapability'
import { formService } from '@/services/FormService'

export function PublicFormReviewPage({ publicationId }: { publicationId: string }) {
  const { value: capability, revision: capabilityRevision } = useFragmentCapability()
  const [cursor, setCursor] = useState<string | undefined>()
  const review = useQuery({
    queryKey: ['public-form-review', publicationId, capabilityRevision, cursor ?? 'first'],
    queryFn: () => formService.review(publicationId, capability, cursor),
    enabled: Boolean(capability),
    gcTime: 0,
    retry: false,
  })
  if (!capability) return <ReviewState title="Chave de review necessária" />
  if (review.isPending) return <ReviewState title="Carregando respostas" loading />
  if (review.isError || !review.data) return <ReviewState title="Review indisponível" description="A chave expirou, foi revogada ou não tem acesso a estas respostas." />
  const data = review.data
  return <main className="min-h-screen bg-contrast px-4 py-8 text-foreground">
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <p className="text-sm opacity-60">{data.form.title ?? 'Cub’s'}</p>
        <h1 className="text-2xl font-semibold">Respostas — {data.form.name}</h1>
      </header>
      <div className="grid gap-4">
        {data.submissions.length === 0 && <div className="rounded-2xl border border-dashed border-divider p-8 text-center text-sm opacity-60">Ainda não há respostas.</div>}
        {data.submissions.map((submission) => <article key={submission.submissionId} className="rounded-2xl border border-divider bg-background p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <time className="text-sm opacity-60">{new Date(submission.submittedAt).toLocaleString()}</time>
            <span className="rounded-full bg-p-green/15 px-2.5 py-1 text-xs font-medium text-p-green">Flow concluído</span>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            {submission.answers.map((answer) => {
              const field = data.form.fields.find((candidate) => candidate.key === answer.key)
              return <div key={answer.key} className="rounded-lg bg-active px-3 py-2">
                <dt className="text-xs opacity-55">{field?.label ?? answer.key}</dt>
                <dd className="mt-1 break-words text-sm">{formatAnswer(answer.value, field?.options)}</dd>
              </div>
            })}
          </dl>
          {submission.flow.callback && <p className="mt-4 rounded-lg border border-p-purple/20 bg-p-purple/5 px-3 py-2 text-sm">{submission.flow.callback}</p>}
        </article>)}
      </div>
      {data.nextCursor && <div className="mt-5 flex justify-center"><Button variant="outlined" onClick={() => setCursor(data.nextCursor ?? undefined)}>Próximas respostas</Button></div>}
    </div>
  </main>
}

function formatAnswer(value: unknown, options?: Array<{ key: string; label: string }>) {
  if (value == null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'string') return options?.find((option) => option.key === value)?.label ?? value
  return String(value)
}

function ReviewState({ title, description, loading }: { title: string; description?: string; loading?: boolean }) {
  return <main className="flex min-h-screen items-center justify-center bg-contrast p-6 text-foreground"><div className="text-center">
    <Icon icon={loading ? 'lucide:loader-circle' : 'lucide:shield-x'} className={`mx-auto mb-3 size-8 text-p-purple ${loading ? 'animate-spin' : ''}`} />
    <h1 className="text-lg font-semibold">{title}</h1>
    {description && <p className="mt-2 max-w-md text-sm opacity-60">{description}</p>}
  </div></main>
}
