import type { GlobalSettingsFragment } from "@/components/GlobalSettingsModal"
import { Typography } from "@/components/Typography"
import { useAuth } from "@/contexts/AuthContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useTheme } from "@/hooks/useTheme"
import { DEFAULT_LANGUAGE, i18n } from "@/lib/i18n"
import { Button, cn, Popover, Switch } from "@/shared/cubs-components"
import { Icon } from "@iconify/react"
import { useLocation, useNavigate, useParams } from "@tanstack/react-router"
import React from "react"

interface SidebarProps {
    collapsed: boolean
    accountMenuOpen?: boolean
    setAccountMenuOpen: (open: boolean) => void
    openGlobalSettings: (fragment: GlobalSettingsFragment) => void
    openSignOutConfirmation: () => void
};

export default ({ 
    collapsed, 
    accountMenuOpen, 
    setAccountMenuOpen, 
    openGlobalSettings,
    openSignOutConfirmation
}: SidebarProps) => {
    const { theme, toggleTheme } = useTheme()
    const auth = useAuth()
    const navigate = useNavigate()
    const { lang } = useParams({ strict: false })
    const location = useLocation()

    const workspaceState = useWorkspace()

    const currentLang = lang ?? DEFAULT_LANGUAGE.slug
    const currentWorkspaceId = workspaceState.workspaceId
    const userLabel = auth.user?.name ?? auth.user?.email ?? i18n('pages.app.account-menu.user')

    const workspacePath = currentWorkspaceId
        ? `/${currentLang}/myworkspace/${currentWorkspaceId}`
        : null;

    const navItems = [
        {
            target: 'home' as const,
            name: i18n('common.navigation.home'),
            active: location.pathname === workspacePath,
            icon: 'cuida:home-outline',
        },
        {
            target: 'collaborating' as const,
            name: i18n('common.navigation.colaborando'),
            active: location.pathname === `/${currentLang}/colaborando`,
            icon: 'cuida:users-outline',
        },
        {
            target: 'chat' as const,
            name: i18n('common.navigation.chat'),
            active: workspacePath !== null && location.pathname === `${workspacePath}/mychat`,
            icon: 'cuida:chatbubble-outline',
        },
        {
            target: 'schedule' as const,
            name: i18n('common.navigation.agenda'),
            active: workspacePath !== null && location.pathname === `${workspacePath}/schedule`,
            icon: 'cuida:calendar-clear-outline',
        },
    ];

    function navigateSidebar(target: 'home' | 'collaborating' | 'chat' | 'schedule') {
        if (!currentWorkspaceId) return
        
        const params = { 
            lang: currentLang, 
            ...(target == 'home' && { workspaceId: currentWorkspaceId })
        };

        const mapRouteTarget = {
            home: `/${currentLang}/myworkspace/${currentWorkspaceId}`,
            collaborating: `/${currentLang}/colaborando`,
            chat: `/${currentLang}/myworkspace/${currentWorkspaceId}/mychat`,
            schedule: `/${currentLang}/myworkspace/${currentWorkspaceId}/schedule`,
        } as const;

        if (location.pathname === mapRouteTarget[target]) return;

        navigate({
            to: mapRouteTarget[target] as unknown as string,
            params,
            replace: true,
        });
    }

    return (
        <aside
            className={cn(
                'm-3 rounded-2xl border border-divider-contrast bg-background p-2 shadow-2xl shadow-dark-900/15 backdrop-blur-xl',
                'flex flex-col justify-between shrink-0 overflow-hidden',
                'transition-[width] duration-300 ease-in-out',
                collapsed ? 'w-14 items-center' : 'w-48 items-start',
            )}
        >
            <div className={cn('flex-1', collapsed ? 'w-9 transition-[width] delay-300 duration-150' : 'w-full')}>
                <nav>
                    <ul className={cn('flex flex-col gap-1')}>
                        {navItems.map((item, index) => (
                            <li key={index}>
                                <button
                                    type="button"
                                    disabled={!currentWorkspaceId}
                                    onClick={() => navigateSidebar(item.target)}
                                    className={cn(
                                        collapsed ? 'w-9' : 'w-full',
                                        'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                                        item.active
                                            ? 'bg-p-purple text-light-100'
                                            : 'glow-purple-hover hover:bg-active',
                                        !currentWorkspaceId && 'cursor-not-allowed opacity-45',
                                    )}
                                >
                                    <Icon icon={item.icon} fontSize={20} className={cn('shrink-0')} />
                                    <Typography variant="body" as="span" className={cn('whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}>
                                        {item.name}
                                    </Typography>
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
            <div className={cn('w-full flex flex-col gap-2')}>
                <Popover
                    open={accountMenuOpen}
                    onOpenChange={setAccountMenuOpen}
                    side="right"
                    align="end"
                    sideOffset={8}
                    trigger={
                        <Button
                            variant="text"
                            color="from-theme"
                            className={cn(
                                collapsed ? 'w-9' : 'w-full',
                                'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                            )}
                            aria-label={i18n('pages.app.account-menu.open')}
                        >
                            <Icon icon="lucide:circle-user-round" fontSize={20} className="shrink-0" />
                            <Typography
                                variant="body"
                                as="span"
                                className={cn('whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}
                            >
                                {userLabel}
                            </Typography>
                        </Button>
                    }
                >
                    <div role="menu" className="flex flex-col gap-0.5">
                        {
                            ([
                                {
                                    render: () => (
                                        <Switch
                                            checked={theme === 'dark'}
                                            onCheckedChange={toggleTheme}
                                            label={i18n('common.modo-escuro')}
                                            className="cursor-pointer w-full flex-row-reverse justify-between h-6 rounded-lg px-2 py-4 bg-transparent"
                                        />
                                    )
                                },
                                { divider: true },
                                {
                                    onClick: () => openGlobalSettings('#profile'),
                                    icon: 'lucide:user-round',
                                    label: userLabel,
                                },
                                {
                                    onClick: () => openGlobalSettings('#settings'),
                                    icon: 'lucide:settings',
                                    label: i18n('pages.app.account-menu.settings')
                                },
                                {
                                    // onClick: () => openGlobalSettings('#notifications'),
                                    icon: 'lucide:bell',
                                    label: i18n('pages.app.account-menu.notifications'),
                                    classNames: 'cursor-not-allowed!',
                                    disabled: true
                                },
                                { divider: true },
                                {
                                    onClick: openSignOutConfirmation,
                                    icon: 'lucide:log-out',
                                    label: i18n('pages.app.account-menu.logout'),
                                    classNames: 'shadow-none! text-p-red! hover:bg-p-red-600/20 dark:hover:bg-p-red-600/10 focus-visible:bg-p-red-600/20'
                                }
                            ] as { divider?: boolean; disabled?: boolean; render?: () => React.ReactNode; onClick?: () => void; icon?: string; label?: string; classNames?: string }[]).map((item, index) => {
                                if (item.divider) 
                                    return <hr key={index} className="border-divider-contrast my-1 z-0" />

                                if (item.render) 
                                    return <React.Fragment key={index}>{item.render()}</React.Fragment>
                                
                                return (
                                    <Button
                                        key={index}
                                        type="button"
                                        color="from-theme"
                                        role="menuitem"
                                        className={cn("cursor-pointer glow-purple-hover flex w-full justify-start items-center gap-2 h-6 rounded-lg px-2 py-4 text-left text-sm transition-[color,background-color,box-shadow] bg-transparent hover:bg-active focus-visible:bg-active focus-visible:outline-none", item?.classNames)}
                                        onClick={item?.onClick}
                                        disabled={item?.disabled}
                                    >
                                        {item.icon && <Icon icon={item.icon} className="sizes-5 shrink-0" />}
                                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                    </Button>
                                )
                            })
                        }
                    </div>
                </Popover>
            </div>
        </aside>
    )
}