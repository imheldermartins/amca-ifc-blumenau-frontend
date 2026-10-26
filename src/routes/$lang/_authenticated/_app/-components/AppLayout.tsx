import { Outlet, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import {
  GlobalSettingsContent,
  type GlobalSettingsFragment,
} from '@components/GlobalSettingsModal'
import { SignOutConfirmationContent } from '@components/SignOutConfirmationModal'
import { useAuth } from '@/contexts/AuthContext'
import { useModal } from '@/hooks/useModal'
import { useLocalStorageState } from '@/hooks/useClientStorage'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { MobileSidebar } from './MobileSidebar'
import { useMediaQuery } from '@/shared/cubs-components/lib/useMediaQuery'

export function AppLayout() {
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobile = useMediaQuery('(width < 48rem)')
  const location = useLocation()
  const auth = useAuth()
  const { openModal } = useModal()

  useEffect(() => {
    setMobileMenuOpen(false)
    setAccountMenuOpen(false)
  }, [location.pathname, mobile])

  function setMobileNavigationOpen(open: boolean) {
    setMobileMenuOpen(open)
    if (!open) setAccountMenuOpen(false)
  }

  function openGlobalSettings(fragment: GlobalSettingsFragment) {
    setAccountMenuOpen(false)
    setMobileMenuOpen(false)
    openModal({
      size: 'xl',
      className: 'p-0',
      content: <GlobalSettingsContent initialFragment={fragment} />,
    })
  }

  function openSignOutConfirmation() {
    setAccountMenuOpen(false)
    setMobileMenuOpen(false)
    openModal({
      size: 'sm',
      className: 'px-5 pb-5 pt-1',
      content: ({ closeModal }) => <SignOutConfirmationContent
        onClose={closeModal}
        onConfirm={async () => {
          closeModal()
          await auth.signOut()
        }}
      />,
    })
  }

  return (
    <div className='flex h-dvh flex-col overflow-hidden bg-background'>
      {!mobile && <Topbar collapsed={collapsed} setCollapsed={() => setCollapsed((c) => !c)} />}

      <div className='flex flex-1 min-h-0'>
        {mobile ? <MobileSidebar
          open={mobileMenuOpen}
          onOpenChange={setMobileNavigationOpen}
          accountMenuOpen={accountMenuOpen}
          openGlobalSettings={openGlobalSettings}
          openSignOutConfirmation={openSignOutConfirmation}
          setAccountMenuOpen={setAccountMenuOpen}
        /> : <Sidebar
          accountMenuOpen={accountMenuOpen} 
          collapsed={collapsed}
          openGlobalSettings={openGlobalSettings}
          openSignOutConfirmation={openSignOutConfirmation}
          setAccountMenuOpen={setAccountMenuOpen}
        />}

        <main className='min-h-0 min-w-0 flex-1 overflow-y-auto pt-16 md:pt-0'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
