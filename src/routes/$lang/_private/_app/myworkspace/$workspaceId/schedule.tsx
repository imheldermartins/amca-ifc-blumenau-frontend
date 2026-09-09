import { createFileRoute } from '@tanstack/react-router'

import { WorkspaceFeaturePage } from '@/pages/app/WorkspaceFeaturePage'
import { i18n } from '@/lib/i18n'

export const Route = createFileRoute('/$lang/_private/_app/myworkspace/$workspaceId/schedule')({
  component: () => (
    <WorkspaceFeaturePage
      title={i18n('common.navigation.agenda')}
      description={i18n('pages.app.schedule.description')}
      icon="cuida:calendar-clear-outline"
    />
  ),
})
