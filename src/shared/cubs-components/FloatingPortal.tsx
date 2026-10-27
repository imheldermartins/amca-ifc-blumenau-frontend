import type {ReactNode} from 'react'
import {FloatingPortalContext} from './lib/floatingPortal'

/** Keep floating editors inside the active dialog's focus scope, outside its scroller. */
export function FloatingPortalProvider({container, children}: {container: HTMLElement | null; children: ReactNode}) {
  return <FloatingPortalContext.Provider value={container}>{children}</FloatingPortalContext.Provider>
}
