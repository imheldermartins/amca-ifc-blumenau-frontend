import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/sign-in">{children}</a>,
  useNavigate: () => mocks.navigate,
  useParams: () => ({ lang: 'pt-br' }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ signUp: mocks.signUp }),
}))

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: { icon: string; className?: string }) => (
    <span data-icon={icon} {...props} />
  ),
}))

import { SignUpPage } from './SignUpPage'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.signUp.mockResolvedValue({
    user: { id: 'user-1', name: 'Helder da Silva', email: 'helder@ifc.edu.br' },
    workspace: { id: 'workspace-1', name: 'Area de Trabalho do Helder' },
  })
})

describe('SignUpPage', () => {
  it('entra diretamente na workspace privada devolvida pelo cadastro comum', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <SignUpPage />
      </QueryClientProvider>,
    )

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Helder da Silva' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'helder@ifc.edu.br' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'segredo1' } })
    fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: 'segredo1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({
      name: 'Helder da Silva',
      email: 'helder@ifc.edu.br',
      password: 'segredo1',
    }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/$lang/myworkspace/$workspaceId',
      params: { lang: 'pt-br', workspaceId: 'workspace-1' },
      replace: true,
    }))
  })
})
