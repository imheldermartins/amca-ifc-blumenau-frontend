import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TableGroupAccordion } from './TableGroupAccordion'

afterEach(() => cleanup())

describe('TableGroupAccordion', () => {
  it('usa faixa neutra, etiqueta roxa deslocada e preserva o accordion', () => {
    render(
      <TableGroupAccordion
        rows={[{ id: '1', cells: { area: { value: 'Administração' } } }]}
        groupBy={['area']}
        columns={[{ id: 'area', title: 'Área de atuação', type: 'text' }]}
        columnTypes={{ area: 'text' }}
        labels={{
          empty: 'Sem valor',
          true: 'Sim',
          false: 'Não',
          rows: (count) => `${count} linha`,
        }}
        renderRow={(row) => <div key={row.id} data-testid={`row-${row.id}`} />}
      />,
    )

    const button = screen.getByRole('button', { expanded: true })
    const tag = button.querySelector('.bg-p-purple') as HTMLElement
    const count = screen.getByText('1 linha')

    expect(button.className).toContain('bg-contrast')
    expect(button.className).toContain('hover:bg-active')
    expect(button.className).not.toContain('bg-p-purple ')
    expect(button.style.paddingLeft).toBe('16px')
    expect(tag.className).toContain('-translate-x-1')
    expect(tag.className).toContain('whitespace-nowrap')
    expect(count.className).toContain('bg-background')
    expect(screen.getByTestId('row-1')).not.toBeNull()

    fireEvent.click(button)
    expect(screen.queryByTestId('row-1')).toBeNull()
  })
})
