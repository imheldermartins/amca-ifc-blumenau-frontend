import { Typography } from "@/components/Typography"
import { i18n } from "@/lib/i18n"
import { workspacePreference } from "@/lib/workspacePreference"
import { can } from "@/services/AccessService"
import type { AuthUser } from "@/services/AuthService"
import type { ApiWorkspace } from "@/services/WorkspaceService"
import { Button, Switch } from "@/shared/cubs-components"
import { Icon } from "@iconify/react"

export const WorkspacesCards = ({ workspace, ownerLabel, headerLabel, preferredId, user, refreshPreference, openWorkspace, openWorkspaceSettings }: {
    workspace: ApiWorkspace
    ownerLabel: string
    headerLabel: string
    preferredId: string | null
    user: AuthUser | null
    refreshPreference: (callback: (revision: number) => number) => void
    openWorkspace: (workspace: ApiWorkspace) => void
    openWorkspaceSettings: (workspace: ApiWorkspace) => void
}) => {
    return (
        <li key={workspace.id} className="w-full flex flex-col gap-3 rounded-xl bg-contrast border border-divider">
            <div className="p-3 flex flex-row items-start gap-3">
                {workspace.icon && (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-light-300 dark:bg-dark-700">
                        <Icon icon={workspace.icon} className="size-5" />
                    </span>
                )}
                <div className="flex-1">
                    <Typography variant="subtitle" as="h3" className="truncate text-md font-semibold text-dark-900 dark:text-light-300">
                        {headerLabel}
                    </Typography>
                    <Typography variant="caption" as="p" className="truncate text-dark-100 dark:text-light-900">
                        {ownerLabel}
                    </Typography>
                </div>
            </div>
            <div className="px-3 mt-4 w-full flex flex-col items-center justify-center gap-2">
                {can(workspace, 'write', 'update') && (
                    <Button className='w-full ' type="button" variant="text" color="from-theme" onClick={() => openWorkspaceSettings(workspace)}>
                        <Icon icon="lucide:settings-2" className="size-4" />
                        {i18n('pages.workspaces.selector.settings')}
                    </Button>
                )}
                <Button className='w-full ' type="button" variant="filled" onClick={() => openWorkspace(workspace)}>
                    {i18n('pages.workspaces.selector.enter')}
                </Button>
            </div>
            <div className="border-t border-light-300 dark:border-dark-700 p-3 mt-3">
                <Switch
                    checked={preferredId === workspace.id}
                    onCheckedChange={(checked) => {
                        if (!user) return
                        if (checked) workspacePreference.set(user.id, workspace.id)
                        else workspacePreference.clear(user.id)
                        refreshPreference((revision) => revision + 1)
                    }}
                    label={i18n('pages.workspaces.selector.preferred')}
                    className="w-full text-xs"
                />
            </div>
        </li>
    )
}