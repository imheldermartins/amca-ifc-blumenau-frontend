import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'cubs-components'
import { FormView, type DataViewSettings, type FormSubmissionInput, type HeaderCol } from 'cubs-database'

import { Modal } from '@/components/Modal'
import { pageDocumentService } from '@/services/PageDocumentService'

const BlockEditor = lazy(() =>
  import('./block-editor/Editor').then(({ Editor }) => ({ default: Editor })),
)

/**
 * Conteúdo da aba de documento da página.
 *
 * O documento usa persistência própria e mantém os blocos de formulário
 * referenciando apenas a view; label e ícone são resolvidos ao renderizar.
 */
export function PageBlockEditor({
  pageId,
  settings,
  columns,
  lockedColumnKeys,
  onSubmit,
}: {
  pageId: string
  settings: DataViewSettings
  columns: HeaderCol[]
  lockedColumnKeys?: ReadonlySet<string>
  onSubmit?: (viewId: string, input: FormSubmissionInput) => Promise<unknown>
}) {
  const document = useQuery({
    queryKey: ['page-document', pageId],
    queryFn: () => pageDocumentService.load(pageId),
  })
  const [activeFormViewId, setActiveFormViewId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastContentRef = useRef<import('@tiptap/core').JSONContent | null>(null)
  const mountedRef = useRef(true)
  const activePageRef = useRef(pageId)
  const persist = useCallback(async (content: import('@tiptap/core').JSONContent, report = true) => {
    if (report) setSaveState('saving')
    try {
      await pageDocumentService.save(pageId, content)
      if (report && mountedRef.current && activePageRef.current === pageId && lastContentRef.current === content) setSaveState('saved')
    } catch {
      if (report && mountedRef.current && activePageRef.current === pageId) setSaveState('error')
    }
  }, [pageId])
  const save = useCallback((content: import('@tiptap/core').JSONContent) => {
    lastContentRef.current = content
    setSaveState('saving')
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null
      void persist(content)
    }, 600)
  }, [persist])
  useEffect(() => {
    mountedRef.current = true
    activePageRef.current = pageId
    lastContentRef.current = null
    setSaveState('idle')
    return () => {
      mountedRef.current = false
      if (pendingRef.current) clearTimeout(pendingRef.current)
      if (lastContentRef.current) void persist(lastContentRef.current, false)
    }
  }, [pageId, persist])
  const forms = useMemo(() => Object.entries(settings).flatMap(([viewId, view]) =>
    view.view === 'form' && view.form
      ? [{ viewId, label: view.form.submitButton.label, icon: view.form.submitButton.icon }]
      : []), [settings])
  const activeForm = activeFormViewId ? settings[activeFormViewId] : undefined

  if (document.isPending) return <div aria-busy="true" className="min-h-[30rem] animate-pulse rounded-xl bg-contrast/40" />
  if (document.isError) return <div role="alert" className="grid min-h-[18rem] place-content-center justify-items-center gap-3 rounded-xl border border-divider p-6 text-center">
    <p className="text-sm opacity-70">Não foi possível carregar o documento. Nenhuma alteração foi feita.</p>
    <Button variant="outlined" onClick={() => { void document.refetch() }}>Tentar novamente</Button>
  </div>
  return (
    <div className="w-full py-2">
      <div aria-live="polite" className="mb-2 min-h-5 text-right text-xs opacity-60">
        {saveState === 'saving' && 'Salvando…'}
        {saveState === 'saved' && 'Salvo'}
        {saveState === 'error' && <span role="alert" className="text-p-red">Falha ao salvar. <button type="button" className="underline" onClick={() => {
          if (lastContentRef.current) void persist(lastContentRef.current)
        }}>Tentar novamente</button></span>}
      </div>
      <Suspense
        fallback={(
          <div
            aria-busy="true"
            data-block-editor-loading
            className="min-h-[30rem] animate-pulse rounded-xl bg-contrast/40"
          />
        )}
      >
        <BlockEditor
          content={document.data?.content ?? undefined}
          forms={forms}
          onChange={save}
          onOpenForm={setActiveFormViewId}
        />
      </Suspense>
      <Modal open={Boolean(activeFormViewId)} onOpenChange={(open) => { if (!open) setActiveFormViewId(null) }} size="lg" accessibleTitle={activeForm?.name ?? 'Formulário'}>
        {activeForm?.view === 'form' && activeForm.form ? <FormView
          columns={columns}
          lockedColumnKeys={lockedColumnKeys}
          config={activeForm.form}
          initialMode="preview"
          showModeSwitch={false}
          onSubmit={onSubmit ? (input) => onSubmit(activeFormViewId!, input) : undefined}
        /> : <p className="p-5 text-sm opacity-60">Este formulário não está mais disponível.</p>}
      </Modal>
    </div>
  )
}
