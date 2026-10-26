import { SearchBar } from "@/components/SearchBar";
import { i18n } from "@/lib/i18n";
import { THEME } from "@/lib/theme";
import { Button } from "@/shared/cubs-components";
import { Icon } from "@iconify/react";
import { useCanGoBack } from "@tanstack/react-router";
import { WorkspaceButton } from './WorkspaceButton';

export default ({ collapsed, setCollapsed }: { collapsed: boolean; setCollapsed: () => void }) => {
    const canGoBack = useCanGoBack()
    return (
        <header className='z-20 hidden shrink-0 grid-cols-[minmax(0,1fr)_minmax(12rem,20rem)_minmax(0,1fr)] items-center gap-12 bg-background px-4 py-1 md:grid lg:px-6'>
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
                <div className='absolute inset-y-0 right-full mr-2 flex items-center'>
                    <Button
                        id='button-navigate-back'
                        type='button'
                        variant='text'
                        color='from-theme'
                        disabled={!canGoBack}
                        aria-label={i18n('common.navigation.back')}
                        onClick={() => {
                            if (canGoBack) window.history.back()
                        }}
                        className='size-9 shrink-0 p-0 text-foreground/60 active:translate-y-0 hover:bg-active hover:text-p-purple disabled:bg-transparent disabled:text-foreground/25 disabled:opacity-100'
                    >
                        <Icon aria-hidden='true' icon='lucide:arrow-left' className='pointer-events-none size-4' />
                    </Button>
                </div>
                <SearchBar className='w-full' />
            </div>

            <div className='min-w-0 max-w-full justify-self-end'>
                <WorkspaceButton />
            </div>
        </header>
    );
}
