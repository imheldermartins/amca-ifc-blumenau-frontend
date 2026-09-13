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

vi.mock('@/hooks/useQueryParams', () => ({useQueryParams: () => ({get: () => undefined})}))

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
    verificationRequired: true,
    email: 'helder@ifc.edu.br',
    notificationPending: false,
  })
})

describe('SignUpPage', () => {
  it('solicita a validação do e-mail antes de criar a sessão', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de validação' }))

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith({
      name: 'Helder da Silva',
      email: 'helder@ifc.edu.br',
    }))
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(await screen.findByText('Verifique seu e-mail')).toBeTruthy()
  })
})
