import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FormViewConfig, HeaderCol } from '../types'
import { DEFAULT_VIEW_MOCK_SETTINGS } from '../viewSettings'
import { ViewSettingsForm } from './ViewSettingsForm'

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-icon={icon} />,
  addCollection: vi.fn(),
}))

const FLOW_A = '01KXVZ0000FLOW00000000001'
const FLOW_B = '01KXVZ0000FLOW00000000002'

const columns: HeaderCol[] = [
  { id: 'page_title', key: 'title', title: 'Nome', type: 'text' },
  { id: FLOW_A, title: 'Flow A', type: 'flow' },
  { id: FLOW_B, title: 'Flow B', type: 'flow' },
]

const form: FormViewConfig = {
  version: 1,
  flowColumnId: FLOW_A,
  submitButton: { label: 'Enviar', icon: 'lucide:send' },
}

describe('ViewSettingsForm — Form', () => {
  it('edita Flow e label como uma configuração coesa e oferece o icon picker', async () => {
    const onFormChange = vi.fn()
    render(
      <ViewSettingsForm
        type="form"
        settings={DEFAULT_VIEW_MOCK_SETTINGS}
        onChange={vi.fn()}
        columns={columns}
        form={form}
        onFormChange={onFormChange}
      />,
    )

    fireEvent.click(screen.getByRole('combobox', { name: 'Flow executado no envio' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Flow B' }))
    expect(onFormChange).toHaveBeenCalledWith({ ...form, flowColumnId: FLOW_B })

    const label = screen.getByLabelText('Texto do botão')
    fireEvent.change(label, { target: { value: 'Responder agora' } })
    fireEvent.blur(label)
    expect(onFormChange).toHaveBeenCalledWith({
      ...form,
      submitButton: { ...form.submitButton, label: 'Responder agora' },
    })
    expect(screen.getByRole('button', { name: 'Ícone do botão' })).not.toBeNull()
  })
})
