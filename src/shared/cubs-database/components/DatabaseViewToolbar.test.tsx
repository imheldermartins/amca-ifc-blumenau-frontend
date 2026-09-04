import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewFiltersV2 } from '../types'
import { emptyViewFilters } from '../viewFilters'
import { DatabaseViewToolbar, type DatabaseViewToolbarLabels } from './DatabaseViewToolbar'

const labels: DatabaseViewToolbarLabels = {
  newPage: 'Nova',
  groupBy: 'Agrupar por',
  filters: 'Filtros',
  searchColumns: 'Buscar coluna',
  noColumns: 'Nenhuma coluna',
  dragGroup: 'Alterar prioridade',
  selectGroup: 'Selecionar coluna',
  priority: 'Prioridade',
  clearGroups: 'Limpar agrupamento',
  where: 'Onde',
  column: 'Coluna',
  condition: 'Condição',
  value: 'Valor',
  valueFrom: 'Data inicial',
  valueTo: 'Data final',
  addFilter: 'Adicionar filtro',
  removeFilter: 'Remover filtro',
  clearFilters: 'Limpar filtros',
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

function Probe() {
  const [filters, setFilters] = useState<ViewFiltersV2>({
    ...emptyViewFilters('2026-08-30T12:00:00.000Z'),
    passthrough: [['order', 'updated_at']],
  })
  return (
    <>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <DatabaseViewToolbar
        columns={[
          { id: 'name', title: 'Nome', type: 'text' },
          { id: 'area', title: 'Área', type: 'text' },
        ]}
        rows={[]}
        filters={filters}
        labels={labels}
        onChange={setFilters}
      />
    </>
  )
}

function DateProbe() {
  const [filters, setFilters] = useState<ViewFiltersV2>(emptyViewFilters())
  return (
    <>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <DatabaseViewToolbar
        columns={[{ id: 'created', title: 'Criação', type: 'date' }]}
        rows={[]}
        filters={filters}
        labels={labels}
        onChange={setFilters}
      />
    </>
  )
}

function ClearProbe() {
  const [filters, setFilters] = useState<ViewFiltersV2>({
    ...emptyViewFilters('2026-08-30T12:00:00.000Z'),
    clauses: [{ columnId: 'name', condition: 'contains', values: ['Ana'] }],
    groupBy: ['area'],
    passthrough: [['order', 'updated_at']],
  })
  return (
    <>
      <output data-testid="filters">{JSON.stringify(filters)}</output>
      <DatabaseViewToolbar
        columns={[
          { id: 'name', title: 'Nome', type: 'text' },
          { id: 'area', title: 'Área', type: 'text' },
        ]}
        rows={[]}
        filters={filters}
        labels={labels}
        onChange={setFilters}
      />
    </>
  )
}

afterEach(() => cleanup())

function readDocument(): ViewFiltersV2 {
  return JSON.parse(screen.getByTestId('filters').textContent ?? '{}') as ViewFiltersV2
}

describe('DatabaseViewToolbar', () => {
  it('limpa somente os filtros e preserva agrupamento e metadados', () => {
    render(<ClearProbe />)
    fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))

    expect(readDocument()).toEqual({
      version: 2,
      updatedAt: '2026-08-30T12:00:00.000Z',
      clauses: [],
      groupBy: ['area'],
      passthrough: [['order', 'updated_at']],
    })
  })

  it('limpa somente o agrupamento e preserva filtros e metadados', () => {
    render(<ClearProbe />)
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar por' }))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar agrupamento' }))

    expect(readDocument()).toEqual({
      version: 2,
      updatedAt: '2026-08-30T12:00:00.000Z',
      clauses: [{ columnId: 'name', condition: 'contains', values: ['Ana'] }],
      groupBy: [],
      passthrough: [['order', 'updated_at']],
    })
  })

  it('salva grupo no documento sem criar chip e preserva passthrough', () => {
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Agrupar por' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar coluna: Área' }))

    const document = readDocument()
    expect(document.groupBy).toEqual(['area'])
    expect(document.passthrough).toEqual([['order', 'updated_at']])
    expect(document.updatedAt).toBe('2026-08-30T12:00:00.000Z')
    expect(screen.queryByText(/@Área/)).toBeNull()
  })

  it('monta “Onde coluna condição valor” e usa um FilterChip removível', () => {
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Valor' }), {
      target: { value: 'Ana' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar filtro' }))

    expect(screen.getByText('@Nome')).not.toBeNull()
    expect(screen.getByText('Contém')).not.toBeNull()
    expect(screen.getByText('Ana')).not.toBeNull()
    expect(readDocument().clauses).toEqual([
      { columnId: 'name', condition: 'contains', values: ['Ana'] },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro: Nome' }))
    expect(readDocument().clauses).toEqual([])
    expect(readDocument().passthrough).toEqual([
      ['order', 'updated_at'],
    ])
  })

  it('oferece Entre somente pelo registry de date e salva os dois valores', () => {
    render(<DateProbe />)
    fireEvent.click(screen.getByRole('button', { name: 'Filtros' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Condição' }))
    fireEvent.click(screen.getByRole('option', { name: 'Entre' }))

    fireEvent.change(screen.getByLabelText('Data inicial'), {
      target: { value: '2026-08-01T08:30' },
    })
    fireEvent.change(screen.getByLabelText('Data final'), {
      target: { value: '2026-08-31T18:45' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar filtro' }))

    expect(readDocument().clauses).toEqual([
      {
        columnId: 'created',
        condition: 'between',
        values: [
          new Date('2026-08-01T08:30').toISOString(),
          new Date('2026-08-31T18:45').toISOString(),
        ],
      },
    ])
  })

  it('mostra o estado realtime opcional e encaminha a ação do host', () => {
    const onAction = vi.fn()
    render(
      <DatabaseViewToolbar
        columns={[]}
        rows={[]}
        filters={emptyViewFilters()}
        labels={labels}
        syncStatus={{
          state: 'pending',
          label: 'Filtros alterados há 2 minutos',
          actionLabel: 'Atualizar',
          onAction,
        }}
      />,
    )

    expect(screen.getByRole('status').textContent).toContain('Filtros alterados há 2 minutos')
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(onAction).toHaveBeenCalledOnce()
  })

  it('coloca o CTA circular Nova à esquerda do status e encaminha a criação', async () => {
    const onAddRow = vi.fn()
    render(
      <DatabaseViewToolbar
        columns={[]}
        rows={[]}
        filters={emptyViewFilters()}
        labels={labels}
        onAddRow={onAddRow}
        syncStatus={{ state: 'confirmed', label: 'Atualizado há 1 minuto' }}
      />,
    )

    const button = screen.getByRole('button', { name: 'Nova' })
    const status = screen.getByRole('status')
    expect(button.className).toContain('size-7')
    expect(button.className).toContain('rounded-full')
    expect(button.nextElementSibling).toBe(status)

    fireEvent.focus(button)
    expect((await screen.findByRole('tooltip')).textContent).toContain('Nova')
    fireEvent.click(button)
    expect(onAddRow).toHaveBeenCalledOnce()
  })
})
