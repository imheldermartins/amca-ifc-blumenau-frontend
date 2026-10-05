import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FormViewConfig, HeaderCol } from '../types'
import { FormView } from './FormView'

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
}))

const FLOW_ID = '01KXVZ00000000000000000001'
const NAME_ID = '01KXVZ00000000000000000002'
const AGE_ID = '01KXVZ00000000000000000003'
const ACTIVE_ID = '01KXVZ00000000000000000004'
const STATUS_ID = '01KXVZ00000000000000000005'
const DATE_ID = '01KXVZ00000000000000000007'

const columns: HeaderCol[] = [
  { id: 'page_title', key: 'title', title: 'Nome', type: 'text', publicKey: { key: 'nome', aliases: [] } },
  { id: NAME_ID, title: 'E-mail', type: 'text', publicKey: { key: 'email', aliases: [] } },
  { id: AGE_ID, title: 'Idade', type: 'numeric', publicKey: { key: 'idade', aliases: [] } },
  { id: ACTIVE_ID, title: 'Ativo', type: 'checkbox', publicKey: { key: 'ativo', aliases: [] } },
  {
    id: STATUS_ID,
    title: 'Status',
    type: 'select',
    publicKey: { key: 'status', aliases: [] },
    options: [{
      id: '01KXVZ00000000000000000006',
      label: 'Novo',
      publicKey: { key: 'novo', aliases: [] },
    }],
  },
  { id: DATE_ID, title: 'Data', type: 'date', publicKey: { key: 'data', aliases: [] } },
  { id: FLOW_ID, title: 'Disparar', type: 'flow' },
]

const config: FormViewConfig = {
  version: 1,
  flowColumnId: FLOW_ID,
  submitButton: { label: 'Enviar inscrição', icon: 'lucide:send' },
}

describe('FormView', () => {
  it('impede o envio quando o Flow é bloqueado com o formulário aberto', () => {
    const onSubmit = vi.fn(async () => undefined)
    const view = render(<FormView columns={columns} config={config} onSubmit={onSubmit} initialMode="preview" />)
    expect((screen.getByRole('button', { name: 'Enviar inscrição' }) as HTMLButtonElement).disabled).toBe(false)
    view.rerender(<FormView columns={columns} config={config} onSubmit={onSubmit} initialMode="preview" lockedColumnKeys={new Set([FLOW_ID])} />)
    expect((screen.getByRole('button', { name: 'Enviar inscrição' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onSubmit).not.toHaveBeenCalled()
  })
  it('disables locked title and checkbox fields and omits them from submissions', async () => {
    const onSubmit = vi.fn(async () => undefined)
    render(<FormView columns={columns} config={config} onSubmit={onSubmit} lockedColumnKeys={new Set(['title', ACTIVE_ID])} initialMode="preview" />)
    expect((screen.getByLabelText('Nome') as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Ativo' }).hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ fields: [{ key: 'email', value: 'ana@example.com' }] }))
  })
  it('constrói um campo por coluna não-Flow e alterna para o preview', () => {
    render(<FormView columns={columns} config={config} />)

    expect(screen.getByText('6 campos')).not.toBeNull()
    expect(screen.queryByText('Disparar')).toBeNull()
    expect((screen.getByLabelText('Nome') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar formulário' }))
    expect(screen.getByLabelText('Nome')).not.toBeNull()
    expect(screen.getByLabelText('E-mail')).not.toBeNull()
    expect(screen.getByLabelText('Idade').getAttribute('type')).toBe('number')
    expect(screen.getByRole('checkbox', { name: 'Ativo' })).not.toBeNull()
    expect(screen.getByLabelText('Status')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Data' })).not.toBeNull()
  })

  it('emite um único payload tipado usando as chaves públicas', async () => {
    const onSubmit = vi.fn(async () => undefined)
    render(<FormView columns={columns} config={config} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar formulário' }))
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Idade'), { target: { value: '31' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Ativo' }))
    fireEvent.click(screen.getByLabelText('Status'))
    fireEvent.click(screen.getAllByRole('option', { name: 'Novo' }).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Enviar inscrição' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith({
      clientRequestId: expect.any(String),
      fields: [
        { key: 'nome', value: 'Ana' },
        { key: 'email', value: 'ana@example.com' },
        { key: 'idade', value: 31 },
        { key: 'ativo', value: true },
        { key: 'status', value: 'novo' },
      ],
    })
    expect(screen.getByRole('status').textContent).toContain('Resposta enviada com sucesso.')
  })

  it('fica em estado reparável quando o Flow vinculado não existe', () => {
    render(<FormView columns={columns.filter((column) => column.type !== 'flow')} config={config} />)
    expect(screen.getByRole('alert').textContent).toContain('O Flow vinculado não está disponível.')
  })

  it('usa o DatePicker compartilhado e abre o calendário pelo input inteiro', () => {
    render(<FormView columns={columns} config={config} />)
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar formulário' }))
    fireEvent.click(screen.getByRole('button', { name: 'Data' }))

    expect(screen.getByRole('grid', { name: 'Calendário' })).not.toBeNull()
  })

  it('persiste campos ocultos por view e não os renderiza no preenchimento', () => {
    const onConfigChange = vi.fn()
    const rendered = render(
      <FormView columns={columns} config={config} onConfigChange={onConfigChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar do preenchimento: E-mail' }))
    expect(onConfigChange).toHaveBeenCalledWith({
      ...config,
      hiddenFieldIds: [NAME_ID],
    })

    rendered.rerender(
      <FormView
        columns={columns}
        config={{ ...config, hiddenFieldIds: [NAME_ID] }}
        onConfigChange={onConfigChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar formulário' }))
    expect(screen.queryByLabelText('E-mail')).toBeNull()
    expect(screen.getByLabelText('Nome')).not.toBeNull()
  })

  it('renderiza o seletor de modo no slot do header', () => {
    const target = document.createElement('div')
    document.body.append(target)
    render(<FormView columns={columns} config={config} headerPortalTarget={target} />)

    expect(within(target).getByRole('button', { name: 'Criar formulário' })).not.toBeNull()
    expect(within(target).getByRole('button', { name: 'Visualizar formulário' })).not.toBeNull()
    target.remove()
  })
})
