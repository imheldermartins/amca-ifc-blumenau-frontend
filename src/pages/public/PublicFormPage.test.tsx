import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicFormPage } from './PublicFormPage'
const service = vi.hoisted(() => ({ definition: vi.fn(), relationOptions: vi.fn(), submit: vi.fn(async () => ({ callback: null })) }))
vi.mock('@iconify/react', () => ({ Icon: ({ icon }: { icon: string }) => <span data-icon={icon} /> }))
vi.mock('@/services/FormService', () => ({ formService: service }))
vi.mock('@/hooks/useFragmentCapability', () => ({ useFragmentCapability: () => ({ value: 'local-test', revision: 0 }) }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
describe('public form column locks', () => {
  it('busca opções pela capability e envia a relação selecionada', async () => {
    service.submit.mockClear()
    service.definition.mockResolvedValue({ version: 1, publicationId: 'pub', title: 'Base', name: 'Form', submitButton: { label: 'Enviar', icon: null }, fields: [
      { key: 'pedido', label: 'Pedido', type: 'relation', relation: { version: 1, targetDatabaseId: 'destino', cardinality: 'one' } },
    ] })
    service.relationOptions.mockResolvedValue({ items: [{ id: 'a', title: 'Pedido A' }], nextCursor: null })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><PublicFormPage publicationId="pub" /></QueryClientProvider>)
    fireEvent.click(await screen.findByRole('button', { name: 'Pedido' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pedido A' }))
    expect(service.relationOptions).toHaveBeenCalledWith('pub', 'local-test', 'pedido', { search: undefined, limit: 50 })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    await waitFor(() => expect(service.submit).toHaveBeenCalledWith('pub', 'local-test', expect.any(String), [{ key: 'pedido', value: ['a'] }]))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Resposta enviada com sucesso.'))
  })
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
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Resposta enviada com sucesso.'))
  })
})
