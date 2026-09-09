export const workspaceQueryKey = (userId: string, workspaceId: string) =>
  ['workspace', userId, workspaceId] as const

export const workspaceMembersQueryKey = (userId: string, workspaceId: string) =>
  ['workspace-members', userId, workspaceId] as const
