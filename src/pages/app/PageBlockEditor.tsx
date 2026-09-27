import { lazy, Suspense } from 'react'

const BlockEditor = lazy(() =>
  import('./block-editor/Editor').then(({ Editor }) => ({ default: Editor })),
)

/**
 * Conteúdo da aba de documento da página.
 *
 * O editor ainda é local: este componente só oferece o ponto de montagem real
 * dentro de `/page/:id`; persistência e realtime do documento exigem um
 * contrato próprio e não são inferidos do snapshot da database.
 */
export function PageBlockEditor() {
  return (
    <div className="w-full py-2">
      <Suspense
        fallback={(
          <div
            aria-busy="true"
            data-block-editor-loading
            className="min-h-[30rem] animate-pulse rounded-xl bg-contrast/40"
          />
        )}
      >
        <BlockEditor />
      </Suspense>
    </div>
  )
}
