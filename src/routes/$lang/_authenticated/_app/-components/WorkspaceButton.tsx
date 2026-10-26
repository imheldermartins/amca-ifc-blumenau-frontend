import { Typography } from '@/components/Typography'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace, type WorkspaceState } from '@/contexts/WorkspaceContext'
import { i18n } from '@/lib/i18n'
import { replaceQuery } from '@/lib/queryParams'
import { can } from '@/services/AccessService'
import { Button, cn } from '@/shared/cubs-components'
import { Icon } from '@iconify/react'
import { useNavigate } from '@tanstack/react-router'

export function WorkspaceButton({ mobile = false, onNavigate }: {
  mobile?: boolean
  onNavigate?: () => void
}) {
  const { slug: lang } = useLanguage()
  const workspaceState = useWorkspace()
  const navigate = useNavigate()

  function openWorkspaceArea() {
    const workspace = workspaceState.workspace
    if (can(workspace, 'write', 'update')) {
      onNavigate?.()
      void navigate({
        to: '/$lang/workspaces/$workspaceId/settings/general',
        params: { lang, workspaceId: workspace!.id },
        search: (previous) => replaceQuery(previous, {}),
      })
      return
    }

    if (!workspaceState.workspaceId || !workspace?.pageRootId) return
    onNavigate?.()
    void navigate({
      to: '/$lang/page/$pageId',
      params: { lang, pageId: workspace.pageRootId },
      search: (previous) => replaceQuery(previous, {}),
    })
  }

  return (
    <Button
      variant="text"
      color="from-theme"
      className={cn(
        'min-w-0 max-w-full rounded-xl px-3 py-2 text-left hover:bg-active/50',
        mobile && 'w-full justify-start gap-3 border border-divider-contrast bg-contrast p-3',
      )}
      onClick={openWorkspaceArea}
      aria-label={i18n('common.workspace.abrir-detalhes')}
    >
      {(mobile || workspaceState.workspace?.icon) && (
        <Icon icon={workspaceState.workspace?.icon || 'lucide:boxes'} fontSize={20} className="shrink-0 text-foreground/60" />
      )}
      <span className="min-w-0">
        {mobile && <span className="mb-0.5 block text-xs font-normal text-foreground/60">{i18n('pages.workspaces.settings.workspace')}</span>}
        <Typography variant="subtitle" as="span" className="block truncate">
          {workspaceLabel(workspaceState)}
        </Typography>
      </span>
    </Button>
  )
}

const workspaceLabel = (state: WorkspaceState) =>
  state.loading ? i18n('common.carregando')
    : state.failed ? i18n('common.workspace.indisponivel')
      : !state.workspace ? i18n('common.workspace.selecionar')
        : (state.workspace.organizationName ? state.workspace.organizationName + ' • ' : '') + (state.workspace.name ?? i18n('common.workspace.sem-nome'))
