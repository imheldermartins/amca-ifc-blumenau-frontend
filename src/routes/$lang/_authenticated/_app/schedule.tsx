import { createFileRoute } from '@tanstack/react-router'

import { i18n } from '@/lib/i18n'
import { WorkspaceFeaturePage } from '@/pages/app/WorkspaceFeaturePage'

export const Route = createFileRoute('/$lang/_authenticated/_app/schedule')({
  component: () => (
    <WorkspaceFeaturePage
      title={i18n('common.navigation.agenda')}
      description={i18n('pages.app.schedule.description')}
      icon="cuida:calendar-clear-outline"
    />
  ),
})
