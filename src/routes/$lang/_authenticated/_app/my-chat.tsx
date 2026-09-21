import { createFileRoute } from '@tanstack/react-router'

import { i18n } from '@/lib/i18n'
import { WorkspaceFeaturePage } from '@/pages/app/WorkspaceFeaturePage'

export const Route = createFileRoute('/$lang/_authenticated/_app/my-chat')({
  component: () => (
    <WorkspaceFeaturePage
      title={i18n('common.navigation.chat')}
      description={i18n('pages.app.chat.description')}
      icon="cuida:chatbubble-outline"
    />
  ),
})
