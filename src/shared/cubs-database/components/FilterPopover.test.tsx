import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FilterPopover, type FilterPopoverLabels } from './FilterPopover'

const labels: FilterPopoverLabels = {
  trigger: 'Filtros',
  where: 'Onde',
  column: 'Coluna',
  condition: 'Condição',
  value: 'Valor',
  valueFrom: 'Data inicial',
  valueTo: 'Data final',
  selectedOption: 'opção selecionada',
  selectedOptions: 'opções selecionadas',
  add: 'Adicionar',
  clear: 'Limpar filtros',
  true: 'Sim',
  false: 'Não',
  conditions: {
    equals: 'Igual a',
    contains: 'Contém',
    greaterThan: 'Maior que',
    lessThan: 'Menor que',
    between: 'Entre',
  },
}

afterEach(() => cleanup())

describe('FilterPopover — layout compacto', () => {
  it('mantém coluna/condição lado a lado e o valor na linha inteira', () => {
    render(
      <FilterPopover
        columns={[
          {
            id: 'long-column',
            title: 'Uma coluna com um nome realmente muito comprido',
            type: 'text',
          },
        ]}
        columnTypes={{ 'long-column': 'text' }}
        labels={labels}
        filterCount={0}
        onAdd={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))

    const column = screen.getByRole('combobox', { name: 'Coluna' })
    const condition = screen.getByRole('combobox', { name: 'Condição' })
    const value = screen.getByRole('textbox', { name: 'Valor' })
    const grid = column.closest('.grid')

    expect(grid?.className).toContain('grid-cols-2')
    expect(column.className).toContain('text-xs')
    expect(column.className).toContain('min-w-0')
    expect(condition.closest('.grid')).toBe(grid)
    expect(value.closest('.grid')).toBe(grid)
    expect(value.closest('.col-span-2')).not.toBeNull()
  })

  it('mantém os dois limites de between lado a lado na linha de valor', () => {
    render(
      <FilterPopover
        columns={[{ id: 'date', title: 'Data', type: 'date' }]}
        columnTypes={{ date: 'date' }}
        labels={labels}
        filterCount={0}
        onAdd={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Condição' }))
    fireEvent.click(screen.getByRole('option', { name: 'Entre' }))

    const from = screen.getByLabelText('Data inicial')
    const to = screen.getByLabelText('Data final')
    const range = from.closest('.grid')
    expect(from.getAttribute('type')).toBe('datetime-local')
    expect(to.getAttribute('type')).toBe('datetime-local')
    expect(range?.className).toContain('grid-cols-2')
    expect(range?.contains(to)).toBe(true)
  })

  it('abre as options de select em dropdown e envia somente os IDs marcados', () => {
    const onAdd = vi.fn()
    render(
      <FilterPopover
        columns={[
          {
            id: 'status',
            title: 'Status',
            type: 'select',
            options: [
              { id: 'open', label: 'Aberto' },
              { id: 'closed', label: 'Fechado' },
            ],
          },
        ]}
        columnTypes={{ status: 'select' }}
        labels={labels}
        filterCount={0}
        onAdd={onAdd}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    const dropdown = screen.getByRole('combobox', { name: 'Valor' })
    expect(screen.queryByRole('checkbox', { name: 'Aberto' })).toBeNull()

    fireEvent.click(dropdown)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Aberto' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fechado' }))

    expect(dropdown.textContent).toContain('2 opções selecionadas')
    const add = screen.getByRole('button', { name: 'Adicionar' })
    expect((add as HTMLButtonElement).disabled).toBe(false)
    const list = screen.getByRole('listbox', { name: 'Valor' })
    expect(list.className).toContain('flex-col')
    expect(list.className).toContain('overflow-y-auto')
    fireEvent.click(add)
    expect(onAdd).toHaveBeenCalledWith({
      columnId: 'status',
      condition: 'equals',
      values: ['open', 'closed'],
    })
  })

  it('converte igualdade de data e hora para o ISO persistido', () => {
    const onAdd = vi.fn()
    render(
      <FilterPopover
        columns={[{ id: 'date', title: 'Data', type: 'date' }]}
        columnTypes={{ date: 'date' }}
        labels={labels}
        filterCount={0}
        onAdd={onAdd}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    fireEvent.change(screen.getByLabelText('Valor'), {
      target: { value: '2026-09-03T14:30' },
    })

    const add = screen.getByRole('button', { name: 'Adicionar' })
    expect((add as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(add)
    expect(onAdd).toHaveBeenCalledWith({
      columnId: 'date',
      condition: 'equals',
      values: [new Date('2026-09-03T14:30').toISOString()],
    })
  })
})
