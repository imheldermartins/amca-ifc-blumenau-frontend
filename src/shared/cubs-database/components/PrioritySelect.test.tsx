import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PrioritySelect } from './PrioritySelect'
import { reorderPriorityValues } from '../prioritySelect'

const labels = {
  trigger: 'Agrupar por',
  search: 'Buscar coluna',
  empty: 'Nenhuma coluna',
  drag: 'Alterar prioridade',
  select: 'Selecionar coluna',
  priority: 'Prioridade',
  clear: 'Limpar agrupamento',
}

const options = [
  { value: 'area', label: 'Área' },
  { value: 'status', label: 'Status' },
  { value: 'email', label: 'E-mail' },
]

function Probe() {
  const [value, setValue] = useState(['status'])
  return (
    <>
      <output data-testid="value">{value.join(',')}</output>
      <PrioritySelect options={options} value={value} onValueChange={setValue} labels={labels} />
    </>
  )
}

afterEach(() => cleanup())

describe('PrioritySelect', () => {
  it('mostra handle antes do checkbox, pesquisa e acrescenta na última prioridade', () => {
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar por' }))

    const statusHandle = screen.getByRole('button', { name: 'Alterar prioridade: Status' })
    const statusCheckbox = screen.getByRole('checkbox', { name: 'Selecionar coluna: Status' })
    expect(
      statusHandle.compareDocumentPosition(statusCheckbox) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar coluna: Área' }))
    expect(screen.getByTestId('value').textContent).toBe('status,area')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar coluna' }), {
      target: { value: 'mail' },
    })
    expect(screen.getByRole('listitem').textContent).toContain('E-mail')
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.queryByText('Status')).toBeNull()
  })

  it('transforma o drop dos handles na nova ordem de prioridade', () => {
    expect(reorderPriorityValues(['status', 'area'], 'status', 'area')).toEqual([
      'area',
      'status',
    ])
    expect(reorderPriorityValues(['status', 'area'], 'desconhecido', 'area')).toEqual([
      'status',
      'area',
    ])
  })

  it('limpa todos os agrupamentos pelo botão interno e fecha o popover', () => {
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar por' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar agrupamento' }))

    expect(screen.getByTestId('value').textContent).toBe('')
    expect(screen.queryByRole('searchbox', { name: 'Buscar coluna' })).toBeNull()
  })

  it('funciona como ordenação pura sem checkboxes ou ação de limpar', () => {
    render(<PrioritySelect options={options} value={options.map((option) => option.value)} onValueChange={() => undefined} labels={labels} allowSelection={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar por' }))

    expect(screen.getAllByRole('button', { name: /Alterar prioridade:/ })).toHaveLength(3)
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Limpar agrupamento' })).toBeNull()
  })

  it('acumula seleção local e salva uma vez ao fechar', () => {
    const onValueChange = vi.fn()
    render(<PrioritySelect options={options} value={['status']} onValueChange={onValueChange} labels={labels} commitOnClose />)
    const trigger = screen.getByRole('button', { name: 'Agrupar por' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar coluna: Área' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar coluna: E-mail' }))
    expect(onValueChange).not.toHaveBeenCalled()

    fireEvent.click(trigger)
    expect(onValueChange).toHaveBeenCalledTimes(1)
    expect(onValueChange).toHaveBeenCalledWith(['status', 'area', 'email'])
  })
})
