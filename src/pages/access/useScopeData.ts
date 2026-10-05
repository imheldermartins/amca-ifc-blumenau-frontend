import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { accessService, can, rolePermission, type AccessScope } from '@/services/AccessService'

export function useScopeData(scope: AccessScope, id: string) {
  const { user } = useAuth()
  const key = ['access', user?.id, scope, id]
  const access = useQuery({ queryKey: [...key, 'current'], queryFn: () => accessService.current(scope, id), retry: false })
  const catalog = useQuery({ queryKey: ['permission-catalog'], queryFn: accessService.catalog })
  const roles = useQuery({
    queryKey: [...key, 'roles'], queryFn: () => accessService.roles(scope, id),
    enabled: Boolean(access.data && (can(access.data, 'read', 'roles') || [rolePermission[scope], 'add_members', 'promote_members'].some((action) => can(access.data, 'write', action)))),
  })
  return { key, access, catalog, roles }
}
