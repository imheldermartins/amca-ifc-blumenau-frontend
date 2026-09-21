import { Outlet} from '@tanstack/react-router'
import { useState } from 'react'

import {
  GlobalSettingsModal,
  type GlobalSettingsFragment,
} from '@components/GlobalSettingsModal'
import { SignOutConfirmationModal } from '@components/SignOutConfirmationModal'
import { useAuth } from '@/contexts/AuthContext'
import { useDialog } from '@/hooks/useDialog'
import { useLocalStorageState } from '@/hooks/useClientStorage'
import Topbar from './-components/Topbar'
import Sidebar from './-components/Sidebar'

export function AppLayout() {
  const [collapsed, setCollapsed] = useLocalStorageState('sidebarCollapsed', false);
  const [accountMenuOpen, setAccountMenuOpen] = useState<boolean>(false)
  const [settingsFragment, setSettingsFragment] = useState<GlobalSettingsFragment>('#profile')
  const auth = useAuth()
  const globalSettingsDialog = useDialog()
  const signOutDialog = useDialog()

  function openGlobalSettings(fragment: GlobalSettingsFragment) {
    setAccountMenuOpen(false)
    setSettingsFragment(fragment)
    globalSettingsDialog.openDialog()
  }

  function openSignOutConfirmation() {
    setAccountMenuOpen(false)
    signOutDialog.openDialog()
  }

  async function handleSignOut() {
    signOutDialog.closeDialog()
    await auth.signOut()
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

        <main className='flex-1 min-h-0 overflow-y-auto'>
          <Outlet />
        </main>
      </div>

      <GlobalSettingsModal
        {...globalSettingsDialog.dialogProps}
        fragment={settingsFragment}
        onFragmentChange={setSettingsFragment}
      />

      <SignOutConfirmationModal
        {...signOutDialog.dialogProps}
        onConfirm={handleSignOut}
      />
    </div>
  )
}
