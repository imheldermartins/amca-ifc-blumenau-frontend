import { Outlet} from '@tanstack/react-router'
import { useState } from 'react'

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

export function AppLayout() {
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false)
  const auth = useAuth()
  const { openModal } = useModal()

  function openGlobalSettings(fragment: GlobalSettingsFragment) {
    setAccountMenuOpen(false)
    openModal({
      size: 'xl',
      className: 'p-0',
      content: <GlobalSettingsContent initialFragment={fragment} />,
    })
  }

  function openSignOutConfirmation() {
    setAccountMenuOpen(false)
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
      <Topbar collapsed={collapsed} setCollapsed={() => setCollapsed((c) => !c)} />

      <div className='flex flex-1 min-h-0'>
        <Sidebar 
          accountMenuOpen={accountMenuOpen} 
          collapsed={collapsed}
          openGlobalSettings={openGlobalSettings}
          openSignOutConfirmation={openSignOutConfirmation}
          setAccountMenuOpen={setAccountMenuOpen}
        />

        <main className='flex-1 min-h-0 min-w-0 overflow-y-auto'>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
