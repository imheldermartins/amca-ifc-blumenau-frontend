import { createFileRoute } from '@tanstack/react-router'

import { PageRoutePage } from '@/pages/app/PageRoutePage'

/**
 * Uma página QUALQUER pelo id — minha ou compartilhada comigo (é para cá que
 * os cards de "Colaborando" apontam). Fora de `myworkspace` de propósito: a
 * página pode pertencer à workspace de outra pessoa, e pendurá-la sob o meu
 * `workspaceId` mentiria sobre a dona.
 */
export const Route = createFileRoute('/$lang/_private/page/$pageId')({
  component: PageRoutePage,
})
