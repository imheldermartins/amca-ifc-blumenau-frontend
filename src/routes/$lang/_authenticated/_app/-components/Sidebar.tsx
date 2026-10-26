import type { GlobalSettingsFragment } from "@/components/GlobalSettingsModal"
import { NotificationCenter } from '@/components/NotificationCenter'
import { Typography } from "@/components/Typography"
import { SearchBar } from '@/components/SearchBar'
import { useAuth } from "@/contexts/AuthContext"
import { useLanguage } from "@/contexts/LanguageContext"
import { useWorkspace } from "@/contexts/WorkspaceContext"
import { useTheme } from "@/hooks/useTheme"
import { useNotifications } from '@/hooks/useNotifications'
import { useModal } from '@/hooks/useModal'
import { i18n } from "@/lib/i18n"
import { Button, cn, Popover, SOFT_SELECTION_CLASSES, Switch } from "@/shared/cubs-components"
import { Icon } from "@iconify/react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import React from "react"
import { WorkspaceButton } from './WorkspaceButton'

export interface SidebarProps {
    collapsed: boolean
    accountMenuOpen?: boolean
    setAccountMenuOpen: (open: boolean) => void
    openGlobalSettings: (fragment: GlobalSettingsFragment) => void
    openSignOutConfirmation: () => void
    mobile?: boolean
    onNavigate?: () => void
};

export default ({ 
    collapsed, 
    accountMenuOpen, 
    setAccountMenuOpen, 
    openGlobalSettings,
    openSignOutConfirmation,
    mobile = false,
    onNavigate,
}: SidebarProps) => {
    const { theme, toggleTheme } = useTheme()
    const auth = useAuth()
    const navigate = useNavigate()
    const { slug: currentLang } = useLanguage()
    const location = useLocation()

    const workspaceState = useWorkspace()
    const { openModal } = useModal()

    const currentWorkspaceId = workspaceState.workspaceId
    const currentPageRootId = workspaceState.workspace?.pageRootId
    const userLabel = auth.user?.name ?? auth.user?.email ?? i18n('pages.app.account-menu.user')
    const notifications = useNotifications(currentWorkspaceId)

    const workspacePath = currentPageRootId
        ? `/${currentLang}/page/${currentPageRootId}`
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
            active: location.pathname === `/${currentLang}/my-chat`,
            icon: 'cuida:chatbubble-outline',
        },
        {
            target: 'schedule' as const,
            name: i18n('common.navigation.agenda'),
            active: location.pathname === `/${currentLang}/schedule`,
            icon: 'cuida:calendar-clear-outline',
        },
    ];

    function navigateSidebar(target: 'home' | 'collaborating' | 'chat' | 'schedule') {
        if (!currentWorkspaceId || !currentPageRootId) return
        onNavigate?.()

        const mapRouteTarget = {
            home: `/${currentLang}/page/${currentPageRootId}`,
            collaborating: `/${currentLang}/colaborando`,
            chat: `/${currentLang}/my-chat`,
            schedule: `/${currentLang}/schedule`,
        } as const;

        if (location.pathname === mapRouteTarget[target]) return;

        if (target === 'collaborating') {
            void navigate({
                to: '/$lang/colaborando',
                params: { lang: currentLang },
                search: {},
                replace: true,
            })
            return
        }

        if (target === 'home') {
            void navigate({
                to: '/$lang/page/$pageId',
                params: { lang: currentLang, pageId: currentPageRootId },
                search: {},
                replace: true,
            })
            return
        }

        void navigate({
            to: target === 'chat' ? '/$lang/my-chat' : '/$lang/schedule',
            params: { lang: currentLang },
            search: {},
            replace: true,
        })
    }

    return <>
        <aside
            className={cn(
                'flex min-h-0 shrink-0 flex-col justify-between overflow-hidden bg-background',
                mobile
                    ? 'h-full w-full gap-3 p-3'
                    : cn(
                        'm-3 rounded-2xl border border-divider-contrast p-2 shadow-2xl shadow-dark-900/15 backdrop-blur-xl',
                        'transition-[width] duration-300 ease-in-out',
                        collapsed ? 'w-14 items-center' : 'w-48 items-start',
                    ),
            )}
        >
            <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'w-9 transition-[width] delay-300 duration-150' : 'w-full')}>
                {mobile && <div className="mb-3"><WorkspaceButton mobile onNavigate={onNavigate} /></div>}
                {mobile && <SearchBar className="mb-3 w-full" />}
                <nav>
                    <ul className={cn('flex flex-col gap-1')}>
                        {navItems.map((item, index) => (
                            <li key={index}>
                                <button
                                    type="button"
                                    disabled={!currentWorkspaceId || !currentPageRootId}
                                    onClick={() => navigateSidebar(item.target)}
                                    aria-label={item.name}
                                    aria-current={item.active ? 'page' : undefined}
                                    className={cn(
                                        collapsed ? 'w-9' : 'w-full',
                                        'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                                        mobile && 'h-11 rounded-lg',
                                        item.active
                                            ? SOFT_SELECTION_CLASSES
                                            : 'hover:bg-active',
                                        (!currentWorkspaceId || !currentPageRootId) && 'cursor-not-allowed opacity-45',
                                    )}
                                >
                                    <Icon icon={item.icon} fontSize={20} className={cn('shrink-0')} />
                                    <Typography variant="body" as="span" className={cn('truncate whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}>
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
                    side={mobile ? 'top' : 'right'}
                    align="end"
                    sideOffset={8}
                    trigger={
                        <Button
                            variant="text"
                            color="from-theme"
                            className={cn(
                                collapsed ? 'w-9' : 'w-full',
                                'h-9 px-2 flex flex-nowrap justify-start items-center rounded text-sm ease-in-out duration-300 transition-[width,color,background-color,box-shadow] overflow-clip',
                                mobile && 'h-11 rounded-lg',
                            )}
                            aria-label={i18n('pages.app.account-menu.open')}
                        >
                            <Icon icon="lucide:circle-user-round" fontSize={20} className="shrink-0" />
                            <Typography
                                variant="body"
                                as="span"
                                className={cn('truncate whitespace-nowrap transition-[margin]', collapsed ? 'ml-2' : 'ml-1')}
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
                                    onClick: () => {
                                        setAccountMenuOpen(false)
                                        onNavigate?.()
                                        openModal({
                                            size: 'sm',
                                            content: ({ closeModal }) => <NotificationCenter onClose={closeModal} />,
                                        })
                                    },
                                    icon: 'lucide:bell',
                                    label: i18n('pages.app.account-menu.notifications'),
                                    badge: notifications.unreadCount,
                                },
                                { divider: true },
                                {
                                    onClick: openSignOutConfirmation,
                                    icon: 'lucide:log-out',
                                    label: i18n('pages.app.account-menu.logout'),
                                    classNames: 'text-p-red hover:bg-p-red/10 focus-visible:bg-p-red/10 focus-visible:ring-p-red/25'
                                }
                            ] as { divider?: boolean; disabled?: boolean; render?: () => React.ReactNode; onClick?: () => void; icon?: string; label?: string; classNames?: string; badge?: number }[]).map((item, index) => {
                                if (item.divider) 
                                    return <hr key={index} className="border-divider-contrast my-1 z-0" />

                                if (item.render) 
                                    return <React.Fragment key={index}>{item.render()}</React.Fragment>
                                
                                return (
                                    <Button
                                        key={index}
                                        type="button"
                                        variant="text"
                                        color="from-theme"
                                        role="menuitem"
                                        className={cn(
                                            "cursor-pointer flex w-full justify-start items-center gap-2 h-6 rounded-lg px-2 py-4 text-left text-sm transition-[color,background-color] bg-transparent focus-visible:outline-none",
                                            item.classNames ?? 'hover:bg-p-purple/10 hover:text-p-purple focus-visible:bg-p-purple/10 focus-visible:text-p-purple',
                                        )}
                                        onClick={item?.onClick}
                                        disabled={item?.disabled}
                                    >
                                        {item.icon && <Icon icon={item.icon} className="sizes-5 shrink-0" />}
                                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                        {Boolean(item.badge) && <span className="flex min-w-5 items-center justify-center rounded-full bg-p-purple px-1.5 py-0.5 text-[10px] font-semibold text-white">{item.badge}</span>}
                                    </Button>
                                )
                            })
                        }
                    </div>
                </Popover>
            </div>
        </aside>
    </>
}
