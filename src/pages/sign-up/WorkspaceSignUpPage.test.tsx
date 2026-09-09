import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUpWithWorkspace: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/sign-in">{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ lang: 'pt-br' }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signUpWithWorkspace: mocks.signUpWithWorkspace }),
}))

// O ícone é apresentação; o loader assíncrono do Iconify manteria timers
// abertos depois que o jsdom desta suíte fosse desmontado.
vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: { icon: string; className?: string }) => (
    <span data-icon={icon} {...props} />
  ),
}))

import { authService } from '@/services/AuthService'
import { WorkspaceSignUpPage } from './WorkspaceSignUpPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceSignUpPage />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  mocks.navigate.mockReset()
  mocks.signUpWithWorkspace.mockReset()
})

describe('WorkspaceSignUpPage', () => {
  it('preenche a identidade da chave, permite revisar e conclui conta + workspace', async () => {
    vi.spyOn(authService, 'previewWorkspaceKey').mockResolvedValue({
      valid: true,
      name: 'Helder Xavier',
      email: 'helder@ifc.estudantes.edu.br',
    })
    mocks.signUpWithWorkspace.mockResolvedValue({
      user: { id: 'user-1', name: 'Helder Editado', email: 'novo@ifc.estudantes.edu.br' },
      workspace: { id: 'workspace-1', name: 'Laboratório IFC' },
    })

    renderPage()

    fireEvent.change(screen.getByLabelText('Chave única do sistema'), {
      target: { value: 'cubs_ws_v1_secret' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByDisplayValue('Helder Xavier')).toBeTruthy()
    expect(screen.getByDisplayValue('helder@ifc.estudantes.edu.br')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Nome'), {
      target: { value: 'Helder Editado' },
    })
    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'novo@ifc.estudantes.edu.br' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'secret1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByDisplayValue('Area de Trabalho do Helder')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Nome da área de trabalho'), {
      target: { value: 'Laboratório IFC' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta e workspace' }))

    await waitFor(() => expect(mocks.signUpWithWorkspace).toHaveBeenCalledWith({
      key: 'cubs_ws_v1_secret',
      name: 'Helder Editado',
      email: 'novo@ifc.estudantes.edu.br',
      password: 'secret1',
      workspaceName: 'Laboratório IFC',
    }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$lang/myworkspace/$workspaceId',
      params: { lang: 'pt-br', workspaceId: 'workspace-1' },
      replace: true,
    }))
  })

  it('permanece na primeira etapa quando a chave é inválida', async () => {
    vi.spyOn(authService, 'previewWorkspaceKey').mockResolvedValue({ valid: false })

    renderPage()
    fireEvent.change(screen.getByLabelText('Chave única do sistema'), {
      target: { value: 'invalid' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Esta chave não é válida para criar uma workspace.',
    )
    expect(screen.queryByText('Complete seu cadastro')).toBeNull()
  })
})
