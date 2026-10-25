import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'cubs-components'
import { FormView, type DataViewSettings, type FormSubmissionInput, type HeaderCol } from 'cubs-database'

import { useModal } from '@/hooks/useModal'
import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { pageDocumentService } from '@/services/PageDocumentService'
import { EDITOR_IDLE_MS, readDocumentSnapshot, type DocumentSnapshot } from './block-editor/documentChanges'

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
  onLoadRelationOptions,
  onSubmit,
}: {
  pageId: string
  settings: DataViewSettings
  columns: HeaderCol[]
  lockedColumnKeys?: ReadonlySet<string>
  onLoadRelationOptions?: (databaseId: string, input: Parameters<NonNullable<HeaderCol['loadRelationOptions']>>[0]) => ReturnType<NonNullable<HeaderCol['loadRelationOptions']>>
  onSubmit?: (viewId: string, input: FormSubmissionInput) => Promise<unknown>
}) {
  const document = useQuery({
    queryKey: ['page-document', pageId],
    queryFn: () => pageDocumentService.load(pageId),
  })
  const { openModal } = useModal()
  const feedback = useFeedback()
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastContentRef = useRef<DocumentSnapshot | null>(null)
  const mountedRef = useRef(true)
  const activePageRef = useRef(pageId)
  const persist = useCallback(async (snapshot: DocumentSnapshot, report = true) => {
    const shouldReport = () => report && mountedRef.current && activePageRef.current === pageId && lastContentRef.current === snapshot
    try {
      await pageDocumentService.save(pageId, readDocumentSnapshot(snapshot))
      if (shouldReport()) feedback({ title: i18n('pages.app.pagina.views.document.save-success'), variant: 'success' })
    } catch {
      if (shouldReport()) feedback({ title: i18n('pages.app.pagina.views.document.save-error'), variant: 'error' })
    }
  }, [feedback, pageId])
  const save = useCallback((content: DocumentSnapshot) => {
    lastContentRef.current = content
    if (pendingRef.current) clearTimeout(pendingRef.current)
    pendingRef.current = setTimeout(() => {
      pendingRef.current = null
      void persist(content)
    }, EDITOR_IDLE_MS)
  }, [persist])
  useEffect(() => {
    mountedRef.current = true
    activePageRef.current = pageId
    lastContentRef.current = null
    return () => {
      mountedRef.current = false
      if (pendingRef.current) {
        clearTimeout(pendingRef.current)
        pendingRef.current = null
        if (lastContentRef.current) void persist(lastContentRef.current, false)
      }
    }
  }, [pageId, persist])
  const forms = useMemo(() => Object.entries(settings).flatMap(([viewId, view]) =>
    view.view === 'form' && view.form
      ? [{ viewId, label: view.form.submitButton.label, icon: view.form.submitButton.icon }]
      : []), [settings])
  if (document.isPending) return <div aria-busy="true" className="min-h-120 animate-pulse rounded-xl bg-contrast/40" />
  if (document.isError) return <div role="alert" className="grid min-h-72 place-content-center justify-items-center gap-3 rounded-xl border border-divider p-6 text-center">
    <p className="text-sm opacity-70">Não foi possível carregar o documento. Nenhuma alteração foi feita.</p>
    <Button variant="outlined" onClick={() => { void document.refetch() }}>Tentar novamente</Button>
  </div>
  return (
    <div className="w-full">
      <Suspense
        fallback={(
          <div
            aria-busy="true"
            data-block-editor-loading
            className="min-h-120 animate-pulse rounded-xl bg-contrast/40"
          />
        )}
      >
        <BlockEditor
          content={document.data?.content ?? undefined}
          forms={forms}
          onChange={save}
          onChangeDeferred={save}
          onOpenForm={(viewId) => {
            const activeForm = settings[viewId]
            openModal({
              size: 'lg',
              content: activeForm?.view === 'form' && activeForm.form ? <FormView
                columns={columns.map((column) => column.type === 'relation' && column.relation && onLoadRelationOptions ? {
                  ...column,
                  loadRelationOptions: (input) => onLoadRelationOptions(column.relation!.targetDatabaseId, input),
                } : column)}
                lockedColumnKeys={lockedColumnKeys}
                config={activeForm.form}
                initialMode="preview"
                showModeSwitch={false}
                onSubmit={onSubmit ? (input) => onSubmit(viewId, input) : undefined}
              /> : <p className="p-5 text-sm opacity-60">Este formulário não está mais disponível.</p>,
            })
          }}
        />
      </Suspense>
    </div>
  )
}
