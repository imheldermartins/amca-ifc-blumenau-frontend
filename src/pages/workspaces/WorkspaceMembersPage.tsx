import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RadioGroup } from 'cubs-components'

import { Typography } from '@/components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { i18n } from '@/lib/i18n'
import type { WorkspaceRole } from '@/lib/workspaceAbility'
import { workspaceMembersQueryKey } from '@/lib/workspaceQueryKeys'
import { workspaceService } from '@/services/WorkspaceService'
import { useWorkspaceSettings } from './useWorkspaceSettings'

const roleOptions = () => [
  { value: 'superadmin', label: i18n('pages.workspaces.settings.role-superadmin') },
  { value: 'member', label: i18n('pages.workspaces.settings.role-member') },
] as const

export function WorkspaceMembersPage() {
  const workspace = useWorkspaceSettings()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = workspaceMembersQueryKey(user?.id ?? 'anonymous', workspace.id)
  const members = useQuery({
    queryKey,
    queryFn: () => workspaceService.listMembers(workspace.id),
    enabled: Boolean(user),
  })
  const updateRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: WorkspaceRole }) =>
      workspaceService.updateMemberRole(workspace.id, userId, role),
    onSuccess: (updated) => queryClient.setQueryData(queryKey, updated),
  })
  const superadminCount = members.data?.filter((member) => member.role === 'superadmin').length ?? 0

  return (
    <section aria-labelledby="workspace-members-title">
      <Typography id="workspace-members-title" variant="h2">
        {i18n('pages.workspaces.settings.members')}
      </Typography>
      <Typography variant="body" as="p" className="mt-1 text-dark-100 dark:text-light-900">
        {i18n('pages.workspaces.settings.members-description')}
      </Typography>

      {members.isPending ? (
        <p className="mt-6 text-sm">{i18n('common.carregando')}</p>
      ) : members.isError ? (
        <p role="alert" className="mt-6 text-sm text-p-red">{i18n('pages.workspaces.settings.members-error')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-divider">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead className="bg-active">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">{i18n('pages.workspaces.settings.member-name')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{i18n('pages.workspaces.settings.member-email')}</th>
                <th scope="col" className="px-4 py-3 font-medium">{i18n('pages.workspaces.settings.member-role')}</th>
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => {
                const isLastSuperadmin = member.role === 'superadmin'
                  && superadminCount === 1
                return (
                  <tr key={member.id} className="border-t border-divider">
                    <td className="px-4 py-3">{member.name ?? member.email}</td>
                    <td className="px-4 py-3">{member.email}</td>
                    <td className="px-4 py-3">
                      <RadioGroup
                        aria-label={`${i18n('pages.workspaces.settings.member-role')} · ${member.email}`}
                        options={roleOptions()}
                        value={member.role}
                        inline
                        disabled={isLastSuperadmin
                          || (updateRole.isPending && updateRole.variables?.userId === member.id)}
                        onValueChange={(value) => {
                          if (value === 'superadmin' || value === 'member') {
                            updateRole.mutate({ userId: member.id, role: value })
                          }
                        }}
                      />
                      {isLastSuperadmin && (
                        <p className="mt-1 text-xs text-dark-100 dark:text-light-900">
                          {i18n('pages.workspaces.settings.last-superadmin')}
                        </p>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {updateRole.isError && (
        <p role="alert" className="mt-3 text-sm text-p-red">{i18n('pages.workspaces.settings.role-error')}</p>
      )}
    </section>
  )
}
