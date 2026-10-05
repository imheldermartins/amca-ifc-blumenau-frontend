import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GridView } from './GridView'

afterEach(() => cleanup())

const titleColumn = { id: 'page_title', key: 'title' as const, title: 'Título', type: 'text' as const }
const statusColumn = { id: 'status', title: 'Status', type: 'text' as const }
const row = (value: string | null | undefined) => ({
  id: 'page-1',
  cells: { page_title: { value }, status: { value: 'Ativa' } },
})

describe('GridView — título discreto', () => {
  it.each(['', null, undefined])('mostra Sem Título para %s sem usar outra propriedade como título', (value) => {
    render(<GridView columns={[statusColumn, titleColumn]} rows={[row(value)]} tileSize="medium" onOpenRow={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Sem Título' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Abrir Sem Título' })).not.toBeNull()
    expect(screen.getByText('Ativa')).not.toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('salva apenas no blur, usa a coluna sintética e deixa o placeholder fora do valor', () => {
    const onCellChange = vi.fn()
    const initial = row('')
    render(<GridView columns={[statusColumn, titleColumn]} rows={[initial]} tileSize="medium" onCellChange={onCellChange} />)
    const input = screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement
    expect(input.value).toBe('')
    expect(input.placeholder).toBe('Sem Título')
    act(() => input.focus())
    fireEvent.change(input, { target: { value: '  Meu projeto  ' } })
    expect(onCellChange).not.toHaveBeenCalled()
    fireEvent.blur(input)
    expect(onCellChange).toHaveBeenCalledExactlyOnceWith({ rowId: 'page-1', columnId: 'page_title', value: 'Meu projeto', previousValue: '' })
  })

  it('Enter confirma, limpar salva null e Escape descarta sem escrever', () => {
    const onCellChange = vi.fn()
    render(<GridView columns={[titleColumn]} rows={[row('Projeto')]} tileSize="large" onCellChange={onCellChange} />)
    const input = screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement
    act(() => input.focus())
    fireEvent.change(input, { target: { value: 'Rascunho' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCellChange).not.toHaveBeenCalled()
    expect(input.value).toBe('Projeto')
    act(() => input.focus())
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCellChange).toHaveBeenCalledExactlyOnceWith({ rowId: 'page-1', columnId: 'page_title', value: null, previousValue: 'Projeto' })
  })

  it('mantém o fluxo de abrir separado da edição e respeita o bloqueio do título', () => {
    const onCellChange = vi.fn()
    const onOpenRow = vi.fn()
    const current = row('Projeto')
    const { rerender } = render(<GridView columns={[titleColumn]} rows={[current]} tileSize="small" onCellChange={onCellChange} onOpenRow={onOpenRow} />)
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Projeto' }))
    expect(onOpenRow).toHaveBeenCalledExactlyOnceWith(current)
    expect(onCellChange).not.toHaveBeenCalled()
    rerender(<GridView columns={[titleColumn]} rows={[current]} tileSize="small" onCellChange={onCellChange} lockedColumnKeys={new Set(['title'])} />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Projeto' })).not.toBeNull()
  })

  it('adota o título remoto, cancela o rascunho e não grava por cima no blur', () => {
    const onCellChange = vi.fn()
    const onCellEditConflict = vi.fn()
    const { rerender } = render(<GridView columns={[titleColumn]} rows={[row('Projeto')]} tileSize="medium" onCellChange={onCellChange} onCellEditConflict={onCellEditConflict} />)
    const input = screen.getByRole('textbox', { name: 'Título' }) as HTMLInputElement
    act(() => input.focus())
    fireEvent.change(input, { target: { value: 'Meu rascunho' } })
    rerender(<GridView columns={[titleColumn]} rows={[row('Título remoto')]} tileSize="medium" onCellChange={onCellChange} onCellEditConflict={onCellEditConflict} />)
    expect(input.value).toBe('Título remoto')
    fireEvent.blur(input)
    expect(onCellChange).not.toHaveBeenCalled()
    expect(onCellEditConflict).toHaveBeenCalledExactlyOnceWith({ rowId: 'page-1', columnId: 'page_title', columnTitle: 'Título', value: 'Título remoto', displayValue: 'Título remoto' })
  })
})
