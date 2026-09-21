import { SearchBar } from "@/components/SearchBar";
import { Typography } from "@/components/Typography";
import { useWorkspace, type WorkspaceState } from "@/contexts/WorkspaceContext";
import { DEFAULT_LANGUAGE, i18n } from "@/lib/i18n";
import { replaceQuery } from "@/lib/queryParams";
import { THEME } from "@/lib/theme";
import { can } from "@/services/AccessService";
import { Button } from "@/shared/cubs-components";
import { Icon } from "@iconify/react";
import { useCanGoBack, useNavigate, useParams } from "@tanstack/react-router";

export default ({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: () => void }) => {
    const { lang } = useParams({ strict: false })
    const navigate = useNavigate()
    const canGoBack = useCanGoBack()
    const workspaceState = useWorkspace()

    const currentLang = lang ?? DEFAULT_LANGUAGE.slug
    const currentWorkspaceId = workspaceState.workspaceId

    function openWorkspaceArea() {
        const workspace = workspaceState.workspace
        if (can(workspace, 'write', 'update')) {
            void navigate({
                to: '/$lang/workspaces/$workspaceId/settings/general',
                params: { lang: currentLang, workspaceId: workspace!.id },
                search: (previous) => replaceQuery(previous, {}),
            })
            return
        }

        if (!currentWorkspaceId) return
        void navigate({
            to: '/$lang/myworkspace/$workspaceId',
            params: { lang: currentLang, workspaceId: currentWorkspaceId },
            search: (previous) => replaceQuery(previous, {}),
        })
    }
    return (
        <header className='z-20 grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)_minmax(0,1fr)] items-center py-1 px-6 bg-background'>
            <div className='min-w-0 justify-self-start'>
                <Button
                    variant='text'
                    color='from-theme'
                    className='p-1 hover:bg-transparent'
                    onClick={setCollapsed}
                    aria-label={i18n(collapsed ? 'common.expandir-menu' : 'common.recolher-menu')}
                >
                    <Icon
                        icon={!collapsed ? 'cuida:sidebar-expand-outline' : 'cuida:sidebar-collapse-outline'}
                        fontSize={24}
                        className={THEME.textMuted}
                    />
                </Button>
            </div>
            <div className='relative w-full justify-self-center'>
                <Button
                    type='button'
                    variant='text'
                    color='from-theme'
                    disabled={!canGoBack}
                    aria-label={i18n('common.navigation.back')}
                    onClick={() => {
                        if (canGoBack) window.history.back()
                    }}
                    className='absolute right-full top-1/2 mr-2 size-8 -translate-y-1/2 p-0 text-foreground/60 hover:bg-active hover:text-p-purple disabled:bg-transparent disabled:text-foreground/25 disabled:opacity-100'
                >
                    <Icon icon='lucide:arrow-left' className='size-4' />
                </Button>
                <SearchBar className='w-full' />
            </div>

            <div className='min-w-0 max-w-full justify-self-end'>
                <Button
                    variant='text'
                    color='from-theme'
                    className='min-w-0 max-w-full px-2 py-1 hover:bg-active/50'
                    onClick={openWorkspaceArea}
                    aria-label={i18n('common.workspace.abrir-detalhes')}
                >
                    {workspaceState.workspace?.icon && (
                        <Icon icon={workspaceState.workspace?.icon} fontSize={20} className={THEME.textMuted} />
                    )}
                    <Typography variant="subtitle" as='span' className='truncate ml-0.5'>
                        {workspaceLabel(workspaceState)}
                    </Typography>
                </Button>
            </div>
        </header>
    );
}

const workspaceLabel = (lb: WorkspaceState) =>
    lb.loading ? i18n('common.carregando')
        : lb.failed ? i18n('common.workspace.indisponivel')
            : !lb.workspace ? i18n('common.workspace.selecionar')
                : (lb.workspace.organizationName ? lb.workspace.organizationName + ' • ' : '') + (lb.workspace.name ?? i18n('common.workspace.sem-nome'));