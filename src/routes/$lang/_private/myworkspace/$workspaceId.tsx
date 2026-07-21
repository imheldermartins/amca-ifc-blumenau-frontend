import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceEntryPage } from '@/pages/app/WorkspaceEntryPage'

/**
 * Entrada pela workspace: resolve a página de entrada (`page_root`) e a abre
 * com a MESMA view de `/page/:id`. A workspace só decide POR ONDE se começa;
 * daí para baixo tudo é página → página.
 *
 * O guard de auth e o `WorkspaceProvider` moram no layout `_private` acima —
 * são de TODA a área privada, não desta rota.
 */
export const Route = createFileRoute('/$lang/_private/myworkspace/$workspaceId')({
  component: WorkspaceEntryPage,
})
