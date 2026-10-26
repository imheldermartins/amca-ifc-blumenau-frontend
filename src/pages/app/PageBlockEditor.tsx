import { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from 'cubs-components'

import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { pageDocumentService } from '@/services/PageDocumentService'
import { EDITOR_IDLE_MS, readDocumentSnapshot, type DocumentSnapshot } from './block-editor/documentChanges'
import { pagePdfService } from '@/services/PagePdfService'

export interface PageBlockEditorHandle { pageId: string; flush: () => Promise<void> }

const BlockEditor = lazy(() =>
  import('./block-editor/Editor').then(({ Editor }) => ({ default: Editor })),
)

/**
 * Conteúdo da aba de documento da página.
 *
 * O documento tem persistência própria e edição de conteúdo em blocos.
 */
export function PageBlockEditor({
  ref,
  pageId,
  readOnly = false,
}: {
  ref?: Ref<PageBlockEditorHandle>
  pageId: string
  readOnly?: boolean
}) {
  const document = useQuery({
    queryKey: ['page-document', pageId],
    queryFn: () => pageDocumentService.load(pageId),
  })
  const catalog = useQuery({ queryKey: ['page-pdf-catalog', pageId], queryFn: () => pagePdfService.catalog(pageId) })
  const savingRef = useRef<Promise<unknown> | null>(null)
  const feedback = useFeedback()
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastContentRef = useRef<DocumentSnapshot | null>(null)
  const mountedRef = useRef(true)
  const activePageRef = useRef(pageId)
  const persist = useCallback(async (snapshot: DocumentSnapshot, report = true, failLoud = false) => {
    const shouldReport = () => report && mountedRef.current && activePageRef.current === pageId && lastContentRef.current === snapshot
    try {
      const request = pageDocumentService.save(pageId, readDocumentSnapshot(snapshot))
      savingRef.current = request
      await request
      if (shouldReport()) feedback({ title: i18n('pages.app.pagina.views.document.save-success'), variant: 'success' })
    } catch (error) {
      if (shouldReport()) feedback({ title: i18n('pages.app.pagina.views.document.save-error'), variant: 'error' })
      if (failLoud) throw error
    }
  }, [feedback, pageId])
  useImperativeHandle(ref, () => ({ pageId, flush: async () => {
    if (pendingRef.current) { clearTimeout(pendingRef.current); pendingRef.current = null }
    await savingRef.current?.catch(() => undefined)
    if (lastContentRef.current) await persist(lastContentRef.current, false, true)
  } }), [pageId, persist])
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
  if (document.isPending) return <div aria-busy="true" className="min-h-120 animate-pulse rounded-xl bg-contrast/40" />
  if (document.isError) return <div role="alert" className="grid min-h-72 place-content-center justify-items-center gap-3 rounded-xl border border-divider p-6 text-center">
    <p className="text-sm opacity-70">Não foi possível carregar o documento. Nenhuma alteração foi feita.</p>
    <Button variant="outlined" onClick={() => { void document.refetch() }}>Tentar novamente</Button>
  </div>
  return (
    <div className="w-full">
      {catalog.isError && <p role="alert" className="mb-3 text-sm opacity-65">{i18n('pdf.catalog-error')}</p>}
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
          readOnly={readOnly}
          recursiveColumns={catalog.data?.columns ?? []}
          recursiveRelations={catalog.data?.relations ?? []}
          hasChildren={Boolean(catalog.data?.children.length)}
          onChange={save}
          onChangeDeferred={save}

        />
      </Suspense>
    </div>
  )
}
