import { clientSessionStorage } from '@/lib/clientStorage'
import { workspacePreference } from '@/lib/workspacePreference'

interface CurrentWorkspaceSession {
  userId: string
  workspaceId: string
}

const KEY = 'currentWorkspace'
const EVENT = 'cubs:current-workspace-changed'

function notify(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT))
}

export const currentWorkspaceSession = {
  get(userId: string): string | undefined {
    const current = clientSessionStorage.get<CurrentWorkspaceSession>(KEY)
    return current?.userId === userId ? current.workspaceId : undefined
  },

  resolve(userId: string): string | undefined {
    return this.get(userId) ?? workspacePreference.get(userId)
  },

  set(userId: string, workspaceId: string): void {
    clientSessionStorage.set(KEY, { userId, workspaceId } satisfies CurrentWorkspaceSession)
    notify()
  },

  clear(userId?: string): void {
    const current = clientSessionStorage.get<CurrentWorkspaceSession>(KEY)
    if (!userId || current?.userId === userId) {
      clientSessionStorage.remove(KEY)
      notify()
    }
  },

  subscribe(listener: () => void): () => void {
    if (typeof window === 'undefined') return () => undefined
    window.addEventListener(EVENT, listener)
    return () => window.removeEventListener(EVENT, listener)
  },
}
