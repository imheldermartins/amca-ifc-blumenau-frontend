import { clientLocalStorage } from '@/lib/clientStorage'

export interface WorkspacePreference {
  userId: string
  workspaceId: string
}

const KEY = 'preferredWorkspace'

export const workspacePreference = {
  get(userId: string): string | undefined {
    const preference = clientLocalStorage.get<WorkspacePreference>(KEY)
    return preference?.userId === userId ? preference.workspaceId : undefined
  },

  set(userId: string, workspaceId: string): void {
    clientLocalStorage.set(KEY, { userId, workspaceId } satisfies WorkspacePreference)
  },

  clear(userId?: string): void {
    if (!userId) {
      clientLocalStorage.remove(KEY)
      return
    }
    const preference = clientLocalStorage.get<WorkspacePreference>(KEY)
    if (preference?.userId === userId) clientLocalStorage.remove(KEY)
  },

  resolve<T extends { id: string }>(userId: string, workspaces: T[]): T | undefined {
    const workspaceId = this.get(userId)
    if (!workspaceId) return undefined
    const workspace = workspaces.find((candidate) => candidate.id === workspaceId)
    if (!workspace) this.clear(userId)
    return workspace
  },
}
