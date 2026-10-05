import { WorkspaceCard } from "@/pages/workspaces/WorkspaceCard"
import { i18n } from "@/lib/i18n"
import { workspacePreference } from "@/lib/workspacePreference"
import { can } from "@/services/AccessService"
import type { AuthUser } from "@/services/AuthService"
import type { ApiWorkspace } from "@/services/WorkspaceService"
import { Button, cn, Tooltip } from "@/shared/cubs-components"
import { Icon } from "@iconify/react"

export const WorkspacesCards = ({ workspace, ownerLabel, headerLabel, preferredId, user, refreshPreference, openWorkspace, openWorkspaceSettings, compact = false }: {
    workspace: ApiWorkspace
    ownerLabel: string
    headerLabel: string
    preferredId: string | null
    user: AuthUser | null
    refreshPreference: (callback: (revision: number) => number) => void
    openWorkspace: (workspace: ApiWorkspace) => void
    openWorkspaceSettings: (workspace: ApiWorkspace) => void
    compact?: boolean
}) => {
    return (
        <WorkspaceCard id={workspace.id} name={headerLabel} icon={workspace.icon} ownerLabel={ownerLabel} compact={compact}
            preference={{
                checked: preferredId === workspace.id,
                onCheckedChange: (checked) => {
                    if (!user) return
                    if (checked) workspacePreference.set(user.id, workspace.id)
                    else workspacePreference.clear(user.id)
                    refreshPreference((revision) => revision + 1)
                },
            }}>
                {can(workspace, 'write', 'update') && (
                    compact ? <Tooltip content={i18n('pages.workspaces.selector.settings')}><Button
                        className="size-8 shrink-0 p-1.5" type="button" variant="text" color="from-theme"
                        aria-label={i18n('pages.workspaces.selector.settings')} onClick={() => openWorkspaceSettings(workspace)}
                    ><Icon icon="lucide:settings-2" className="size-4" /></Button></Tooltip>
                    : <Button className="w-full text-xs" type="button" variant="text" color="from-theme" onClick={() => openWorkspaceSettings(workspace)}>
                            <Icon icon="lucide:settings-2" className="size-3.5" />
                            {i18n('pages.workspaces.selector.settings')}
                        </Button>
                )}
                <Button className={cn('rounded-xl text-xs', compact ? 'min-w-24 px-5' : 'w-full')} type="button" variant="filled" onClick={() => openWorkspace(workspace)}>
                    {i18n('pages.workspaces.selector.enter')}
                </Button>
        </WorkspaceCard>
    )
}
