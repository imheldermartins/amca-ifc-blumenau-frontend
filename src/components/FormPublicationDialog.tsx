import { Icon } from '@iconify/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button, cn } from 'cubs-components'

import { Modal } from '@/components/Modal'
import { formService, type FormPublicationSecrets } from '@/services/FormService'

export function FormPublicationDialog({
  open,
  onOpenChange,
  pageId,
  viewId,
  lang,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
  viewId: string | null
  lang: string
}) {
  const status = useQuery({
    queryKey: ['form-publication', pageId, viewId ?? 'none'],
    queryFn: () => formService.status(pageId, viewId!),
    enabled: Boolean(open && viewId),
    retry: false,
  })
  const [secrets, setSecrets] = useState<FormPublicationSecrets | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) {
      setSecrets(null)
      setError('')
    }
  }, [open, viewId])

  const publish = async () => {
    if (!viewId || busy) return
    setBusy(true)
    setError('')
    try {
      const result = await formService.publish(pageId, viewId)
      setSecrets(result)
      await status.refetch()
    } catch {
      setError('Não foi possível publicar o formulário.')
    } finally {
      setBusy(false)
    }
  }
  const revoke = async () => {
    if (!viewId || busy) return
    setBusy(true)
    setError('')
    try {
      await formService.revoke(pageId, viewId)
      setSecrets(null)
      await status.refetch()
    } catch {
      setError('Não foi possível revogar a publicação.')
    } finally {
      setBusy(false)
    }
  }
  const active = secrets ?? status.data
  const fillUrl = secrets
    ? `${window.location.origin}/${lang}/forms/${secrets.publicationId}#key=${secrets.fillKey}`
    : null
  const reviewUrl = secrets
    ? `${window.location.origin}/${lang}/forms/${secrets.publicationId}/review#key=${secrets.reviewKey}`
    : null

  return <Modal open={open} onOpenChange={onOpenChange} size="md" accessibleTitle="Publicar formulário">
    <h2 className="text-lg font-semibold">Publicar formulário</h2>
    <p className="mt-1 text-sm opacity-60">Gere chaves separadas para responder e revisar. Novas chaves invalidam imediatamente os links anteriores.</p>
    {status.isPending ? <div className="flex min-h-32 items-center justify-center"><Icon icon="lucide:loader-circle" className="size-5 animate-spin text-p-purple" /></div> : <div className="mt-5 grid gap-4">
      {active?.published && !secrets && <div className="rounded-xl border border-divider bg-active p-4 text-sm">
        <p className="font-medium">Formulário publicado</p>
        <p className="mt-1 opacity-60">Preenchimento: {active.fillKeyHint} · Review: {active.reviewKeyHint}</p>
        <p className="mt-2 text-xs opacity-50">Por segurança, os links completos só aparecem quando as chaves são geradas.</p>
      </div>}
      {fillUrl && <SecretLink label="Link para responder" url={fillUrl} />}
      {reviewUrl && <SecretLink label="Link de review" url={reviewUrl} />}
      {error && <p role="alert" className="text-sm text-p-red">{error}</p>}
    </div>}
    <div className="mt-6 flex flex-wrap justify-end gap-2">
      {active?.published && <Button variant="text" color="red" disabled={busy} onClick={() => { void revoke() }}><Icon icon="lucide:ban" className="size-4" />Revogar</Button>}
      <Button disabled={busy} onClick={() => { void publish() }}>
        {busy ? <Icon icon="lucide:loader-circle" className="size-4 animate-spin" /> : <Icon icon="lucide:link" className="size-4" />}
        {active?.published ? 'Rotacionar chaves' : 'Publicar e gerar links'}
      </Button>
    </div>
  </Modal>
}

function SecretLink({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false)
  return <div>
    <label className="text-sm font-medium">{label}</label>
    <div className="mt-1 flex gap-2">
      <input readOnly value={url} aria-label={label} className="min-w-0 flex-1 rounded-lg border border-divider bg-background px-3 py-2 text-xs outline-none" />
      <Button variant="outlined" aria-label={`Copiar ${label}`} onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        })
      }}><Icon icon={copied ? 'lucide:check' : 'lucide:copy'} className={cn('size-4', copied && 'text-p-green')} /></Button>
    </div>
  </div>
}
