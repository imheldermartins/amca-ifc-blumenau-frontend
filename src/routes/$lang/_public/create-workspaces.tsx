import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceSignUpPage } from '@/pages/sign-up/WorkspaceSignUpPage'

export const Route = createFileRoute('/$lang/_public/create-workspaces')({
  component: WorkspaceSignUpPage,
})

