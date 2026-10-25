import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { FormViewConfig, HeaderCol, HeatmapConfig } from '../types'
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

describe('ViewSettingsForm — Heatmap', () => {
  it('seleciona várias checkboxes vinculadas à mesma data e exige pelo menos uma', () => {
    const heatmap: HeatmapConfig = { version: 2, dateColumnId: 'date', checkboxColumnIds: ['done'], period: { mode: 'year' } }
    const onHeatmapChange = vi.fn()
    const props = { type: 'heatmap' as const, heatmap, onHeatmapChange, settings: DEFAULT_VIEW_MOCK_SETTINGS, onChange: vi.fn(), columns: [
      { id: 'date', title: 'Dia', type: 'date' as const },
      { id: 'done', title: 'Feito', type: 'checkbox' as const },
      { id: 'review', title: 'Revisado', type: 'checkbox' as const },
      { id: 'note', title: 'Texto', type: 'text' as const },
    ] }
    const view = render(<ViewSettingsForm {...props} />)
    expect(screen.getByRole('checkbox', { name: 'Feito' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByRole('checkbox', { name: 'Texto' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revisado' }))
    expect(onHeatmapChange).toHaveBeenLastCalledWith({ ...heatmap, checkboxColumnIds: ['done', 'review'] })
    view.rerender(<ViewSettingsForm {...props} heatmap={{ ...heatmap, checkboxColumnIds: ['done', 'review'] }} />)
    expect(screen.getByText(/soma de marcadas em Feito \+ Revisado por Dia/)).toBeTruthy()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Feito' }))
    expect(onHeatmapChange).toHaveBeenLastCalledWith({ ...heatmap, checkboxColumnIds: ['review'] })
  })
})
