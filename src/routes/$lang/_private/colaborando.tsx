import { createFileRoute } from '@tanstack/react-router'

import { CollaboratingPage } from '@/pages/app/CollaboratingPage'

/** Páginas compartilhadas COMIGO (sou membro, não dono). */
export const Route = createFileRoute('/$lang/_private/colaborando')({
  component: CollaboratingPage,
})
