import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicFormPage } from './PublicFormPage'
const service = vi.hoisted(() => ({ definition: vi.fn(), submit: vi.fn(async () => ({ callback: null })) }))
vi.mock('@/services/FormService', () => ({ formService: service }))
vi.mock('@/hooks/useFragmentCapability', () => ({ useFragmentCapability: () => ({ value: 'local-test', revision: 0 }) }))
afterEach(cleanup)
describe('public form column locks', () => {
  it('does not serialize disabled checkbox defaults or locked title fields', async () => {
    service.definition.mockResolvedValue({ version: 1, publicationId: 'pub', title: 'Base', name: 'Form', submitButton: { label: 'Enviar', icon: null }, fields: [
      { key: 'title', label: 'Nome', type: 'text', readOnly: true },
      { key: 'active', label: 'Ativo', type: 'checkbox', readOnly: true },
      { key: 'email', label: 'E-mail', type: 'text' },
    ] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><PublicFormPage publicationId="pub" /></QueryClientProvider>)
    await screen.findByLabelText('E-mail')
    expect((screen.getByLabelText('Nome') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Ativo' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(service.submit).toHaveBeenCalledWith('pub', 'local-test', expect.any(String), [{ key: 'email', value: 'ana@example.com' }]))
  })
})
