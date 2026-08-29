import { fireEvent, render, screen } from '@testing-library/react'
import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CubsDatabase } from './CubsDatabase'

const VIEW_ID = '01KXVZ0000VIEW00000000001'

afterEach(() => cleanup())

describe('CubsDatabase — coluna mestra title', () => {
  it('usa o column_name da view e envia o rename para o snapshot', () => {
    const onPageTitleColumnChange = vi.fn()
    const onColumnRename = vi.fn()

    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            filters: '',
            title: { key: 'title', column_name: 'Docente', mask: 'cpf' },
            orderedHeaderCols: ['page_title'],
          },
        }}
        headerCols={[
          { id: 'page_title', key: 'title', title: 'Título', type: 'text' },
        ]}
        rows={[]}
        onColumnRename={onColumnRename}
        onPageTitleColumnChange={onPageTitleColumnChange}
        labels={{ renameColumn: 'Renomear coluna' }}
      />,
    )

    expect(screen.getByRole('columnheader').textContent).toContain('Docente')
    fireEvent.contextMenu(screen.getByRole('columnheader'))

    const input = screen.getByRole('textbox', { name: 'Renomear coluna' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'Professor' } })
    fireEvent.blur(input)

    expect(onPageTitleColumnChange).toHaveBeenCalledWith(VIEW_ID, {
      key: 'title',
      column_name: 'Professor',
      mask: 'cpf',
    })
    expect(onColumnRename).not.toHaveBeenCalled()
  })
})

describe('CubsDatabase — preview de largura', () => {
  it('sobrepõe a largura persistida somente na view correspondente', () => {
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            filters: '',
            orderedHeaderCols: ['column-1'],
            columnWidths: { 'column-1': 180 },
          },
        }}
        headerCols={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
        columnWidthPreviews={{ [VIEW_ID]: { 'column-1': 333 } }}
      />,
    )

    expect(screen.getByRole('columnheader').style.width).toBe('333px')
  })
})

describe('CubsDatabase — espaçamento das views', () => {
  it('reserva o espaço mínimo comum entre as tabs e qualquer view', () => {
    render(
      <CubsDatabase
        settings={{
          [VIEW_ID]: {
            view: 'table',
            name: 'Tabela',
            filters: '',
            orderedHeaderCols: ['column-1'],
          },
        }}
        headerCols={[{ id: 'column-1', title: 'Nome', type: 'text' }]}
        rows={[]}
      />,
    )

    const viewContainer = screen.getByRole('table').parentElement?.parentElement
    expect(viewContainer?.className).toContain('mt-3.5')
  })
})
