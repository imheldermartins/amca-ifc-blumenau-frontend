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
  add: 'Adicionar',
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
    expect(range?.className).toContain('grid-cols-2')
    expect(range?.contains(to)).toBe(true)
  })
})
