import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useController, useFormContext } from 'react-hook-form'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const dependencies = vi.hoisted(() => ({ update: vi.fn(), navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => dependencies.navigate }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-1', name: 'Helder', email: 'helder@example.test' } }) }))
vi.mock('@/services/WorkspaceService', () => ({ workspaceService: { update: dependencies.update } }))
vi.mock('@/components/IconPicker', () => ({ IconPicker: (props: { name: string; label: string; disabled: boolean; onValueChange: (value: string) => void }) => {
  const form = useFormContext()
  const { field } = useController({ control: form.control, name: props.name })
  return <button type="button" disabled={props.disabled} aria-label={props.label} onClick={() => { field.onChange('lucide:heart'); props.onValueChange('lucide:heart') }}>Ícone</button>
} }))
import type { ApiWorkspace } from '@/services/WorkspaceService'
import { i18n } from '@/lib/i18n'
import { workspacePreference } from '@/lib/workspacePreference'
import { workspaceQueryKey, workspacesQueryKey } from '@/lib/workspaceQueryKeys'
import { WorkspaceSettingsProvider } from './WorkspaceSettingsContext'
import { WorkspaceSettingsHeader } from './WorkspaceSettingsHeader'
import { WorkspaceGeneralSettingsPage } from './WorkspaceGeneralSettingsPage'

const workspace = {
  id: 'workspace-1', name: 'Meu espaço', icon: 'lucide:smile', isPersonal: false, organizationId: 'org-1', organizationName: 'IFC',
  data: {}, owner: { id: 'user-1', name: 'Helder', email: 'helder@example.test' }, role: null, pageRootId: 'root-1', createdByUserId: 'user-1',
  permissions: { read: ['view'], write: ['update'] },
} satisfies ApiWorkspace

function mount(element = <WorkspaceSettingsHeader section="Geral" />, data: ApiWorkspace = workspace) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  client.setQueryData(workspaceQueryKey('user-1', data.id), data)
  client.setQueryData(workspacesQueryKey('user-1'), [data, { ...data, id: 'other' }])
  client.setQueryData(['organization-workspaces', 'user-1', 'org-1'], [{ id: data.id, name: data.name, icon: data.icon, canEnter: true, isMember: true }])
  render(<QueryClientProvider client={client}><WorkspaceSettingsProvider workspace={data}>{element}</WorkspaceSettingsProvider></QueryClientProvider>)
  return client
}
const name = () => screen.getByRole('textbox', { name: i18n('pages.workspaces.settings.name') }) as HTMLInputElement

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); dependencies.update.mockImplementation(async (_id, input) => ({ ...workspace, ...input })) })

describe('configurações do espaço de trabalho', () => {
  it('salva no blur e atualiza contexto, seleção e organização sem botão de salvar', async () => {
    const client = mount()
    fireEvent.change(name(), { target: { value: ' Novo nome ' } })
    expect(dependencies.update).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: i18n('pages.workspaces.settings.save') })).toBeNull()
    expect(name().autocomplete).toBe('off')
    fireEvent.blur(name())
    await waitFor(() => expect(dependencies.update).toHaveBeenCalledWith('workspace-1', { name: 'Novo nome', icon: 'lucide:smile' }))
    await screen.findByRole('status')
    expect(client.getQueryData(workspaceQueryKey('user-1', 'workspace-1'))).toMatchObject({ name: 'Novo nome', icon: 'lucide:smile' })
    expect(client.getQueryData<ApiWorkspace[]>(workspacesQueryKey('user-1'))?.map((item) => item.name)).toEqual(['Novo nome', 'Meu espaço'])
    expect(client.getQueryData(['organization-workspaces', 'user-1', 'org-1'])).toEqual([{ id: 'workspace-1', name: 'Novo nome', icon: 'lucide:smile', canEnter: true, isMember: true }])
    fireEvent.blur(name())
    expect(dependencies.update).toHaveBeenCalledTimes(1)
  })
  it('salva o ícone na seleção sem enviar um nome ainda não confirmado', async () => {
    const client = mount()
    fireEvent.change(name(), { target: { value: 'Rascunho' } })
    fireEvent.click(screen.getByRole('button', { name: i18n('pages.workspaces.settings.icon') }))
    await waitFor(() => expect(dependencies.update).toHaveBeenCalledWith('workspace-1', { name: 'Meu espaço', icon: 'lucide:heart' }))
    await waitFor(() => expect(client.getQueryData(workspaceQueryKey('user-1', 'workspace-1'))).toMatchObject({ icon: 'lucide:heart' }))
    expect(name().value).toBe('Rascunho')
    fireEvent.blur(name())
    await waitFor(() => expect(dependencies.update).toHaveBeenLastCalledWith('workspace-1', { name: 'Rascunho', icon: 'lucide:heart' }))
  })
  it('preserva o rascunho e o cache quando falha, permitindo tentar novamente no blur', async () => {
    dependencies.update.mockRejectedValueOnce(new Error('Sem conexão'))
    const client = mount()
    fireEvent.change(name(), { target: { value: 'Rascunho' } })
    fireEvent.blur(name())
    await screen.findByRole('alert')
    expect(name().value).toBe('Rascunho')
    expect(client.getQueryData(workspaceQueryKey('user-1', 'workspace-1'))).toEqual(workspace)
    fireEvent.blur(name())
    await waitFor(() => expect(client.getQueryData(workspaceQueryKey('user-1', 'workspace-1'))).toMatchObject({ name: 'Rascunho' }))
    expect(dependencies.update).toHaveBeenCalledTimes(2)
  })
  it('valida o nome vazio sem enviar uma atualização', async () => {
    mount()
    fireEvent.change(name(), { target: { value: '   ' } })
    fireEvent.blur(name())
    await screen.findByRole('alert')
    expect(dependencies.update).not.toHaveBeenCalled()
  })
  it('Escape cancela apenas o nome e não dispara salvamento ao sair do campo', () => {
    mount()
    name().focus()
    fireEvent.change(name(), { target: { value: 'Rascunho' } })
    fireEvent.keyDown(name(), { key: 'Escape' })
    expect(name().value).toBe('Meu espaço')
    expect(dependencies.update).not.toHaveBeenCalled()
  })
  it('Enter confirma pelo blur, sem submeter um formulário em buffer', async () => {
    mount()
    name().focus()
    fireEvent.change(name(), { target: { value: 'Novo nome' } })
    fireEvent.keyDown(name(), { key: 'Enter' })
    await waitFor(() => expect(dependencies.update).toHaveBeenCalledWith('workspace-1', { name: 'Novo nome', icon: 'lucide:smile' }))
  })
  it('bloqueia edições e envios sem a permissão de atualizar', async () => {
    mount(undefined, { ...workspace, permissions: { read: ['view', 'members'], write: [] } })
    expect(name().readOnly).toBe(true)
    expect((screen.getByRole('button', { name: i18n('pages.workspaces.settings.icon') }) as HTMLButtonElement).disabled).toBe(true)
    await act(async () => { fireEvent.submit(name().closest('form')!) })
    fireEvent.blur(name())
    expect(dependencies.update).not.toHaveBeenCalled()
  })
  it('impede blurs duplicados enquanto a atualização está pendente', async () => {
    let resolve!: (value: ApiWorkspace) => void
    dependencies.update.mockReturnValue(new Promise((done) => { resolve = done }))
    mount()
    fireEvent.change(name(), { target: { value: 'Novo nome' } })
    fireEvent.blur(name())
    fireEvent.blur(name())
    await screen.findByText(i18n('pages.workspaces.settings.saving'))
    fireEvent.submit(name().closest('form')!)
    expect(name().readOnly).toBe(true)
    expect((screen.getByRole('button', { name: i18n('pages.workspaces.settings.icon') }) as HTMLButtonElement).disabled).toBe(true)
    expect(dependencies.update).toHaveBeenCalledTimes(1)
    resolve({ ...workspace, name: 'Novo nome' })
    await waitFor(() => expect(name().readOnly).toBe(false))
  })
  it('alterna a preferência do usuário sem enviar alterações ao backend', () => {
    workspacePreference.set('user-1', 'other')
    mount(<WorkspaceGeneralSettingsPage />)
    const toggle = screen.getByRole('switch', { name: i18n('pages.workspaces.selector.preferred') })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(workspacePreference.get('user-1')).toBe('workspace-1')
    fireEvent.click(toggle)
    expect(workspacePreference.get('user-1')).toBeUndefined()
    expect(dependencies.update).not.toHaveBeenCalled()
  })
})
