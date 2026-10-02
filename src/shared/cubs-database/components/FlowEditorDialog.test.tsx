import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FlowDefinition, FlowExecutionResult, HeaderCol, RowData } from '../types'
import { FlowEditorDialog } from './FlowEditorDialog'

const flow: FlowDefinition = {
  version: 1,
  trigger: { type: 'manual' },
  nodes: [
    { id: 'start', type: 'start', config: { nextNodeId: 'email' } },
    {
      id: 'email',
      type: 'email',
      config: {
        to: '@people.user-1.email',
        subject: '',
        body: '',
        nextNodeId: 'callback',
      },
    },
    { id: 'callback', type: 'callback', config: { message: 'Concluído' } },
  ],
}

function setValueFlow(columnId: string, value = ''): FlowDefinition {
  return {
    version: 1,
    trigger: { type: 'manual' },
    nodes: [
      { id: 'start', type: 'start', config: { nextNodeId: 'set-value' } },
      {
        id: 'set-value',
        type: 'set_value',
        config: { columnId, value, nextNodeId: 'callback' },
      },
      { id: 'callback', type: 'callback', config: { message: 'Concluído' } },
    ],
  }
}

const column: HeaderCol = { id: 'flow-column', title: 'Aprovação', type: 'flow', flow }
const row: RowData = {
  id: 'page-1',
  cells: { page_title: { value: 'Solicitação 01' } },
}

afterEach(() => cleanup())

describe('FlowEditorDialog', () => {
  it('só abre o catálogo de macros depois de @ e mantém a ordem dos grupos', async () => {
    const onSave = vi.fn()
    const loadMacros = vi.fn().mockResolvedValue([
      { token: '@columns.status', label: 'Status', group: 'columns', preview: 'Pendente' },
      { token: '@workspace.name', label: 'Workspace', group: 'workspace', preview: 'Cub’s' },
      { token: '@page.title', label: 'Título da página', group: 'page', preview: 'Solicitação 01' },
      { token: '@people.user-1.email', label: 'Ana · e-mail', group: 'people', preview: 'ana@example.com' },
    ])

    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      row={row}
      columns={[column, { id: 'status', title: 'Status', type: 'select' }]}
      onOpenChange={vi.fn()}
      loadMacros={loadMacros}
      onSave={onSave}
    />)

    await waitFor(() => expect(loadMacros).toHaveBeenCalledWith({
      columnId: 'flow-column',
      rowId: 'page-1',
    }))
    expect(screen.queryByText('Pessoas desta página')).toBeNull()

    const subject = screen.getByLabelText('Assunto')
    fireEvent.change(subject, {
      target: { value: '@', selectionStart: 1 },
    })

    const groupLabels = [
      'Pessoas desta página',
      'Página',
      'Workspace',
      'Colunas',
    ].map((label) => screen.getByText(label, { selector: 'div' }))
    expect(groupLabels.map((element) => element.textContent)).toEqual([
      'Pessoas desta página',
      'Página',
      'Workspace',
      'Colunas',
    ])
    expect(groupLabels.every((element, index) =>
      index === 0 || Boolean(groupLabels[index - 1]?.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
    )).toBe(true)
    expect(screen.getByText('navegar')).not.toBeNull()

    fireEvent.keyDown(subject, { key: 'ArrowDown' })
    fireEvent.keyDown(subject, { key: 'Enter' })
    expect((subject as HTMLInputElement).value).toBe('@{Titulo_Da_Pagina}')
    const highlightedMention = screen.getByText('@{Titulo_Da_Pagina}')
    expect(highlightedMention.className).not.toContain('px-')
    expect(highlightedMention.className).not.toContain('font-medium')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar flow' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0]?.[1] as FlowDefinition
    expect(saved.nodes.find((node) => node.type === 'email')?.config.subject)
      .toBe('@page.title')
  })

  it('permite ao host recompor e reordenar as seções do catálogo', async () => {
    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      columns={[column]}
      onOpenChange={vi.fn()}
      loadMacros={vi.fn().mockResolvedValue([
        { token: '@people.user-1.email', label: 'Ana · e-mail', group: 'people' },
        { token: '@page.title', label: 'Título da página', group: 'page' },
        { token: '@workspace.name', label: 'Nome do workspace', group: 'workspace' },
        { token: '@columns.status', label: 'Status', group: 'columns' },
      ])}
      buildMacroSections={(scope) => [{
        id: 'context',
        label: 'Contexto customizado',
        options: [...scope.workspace, ...scope.page, ...scope.columns],
      }]}
      onSave={vi.fn()}
    />)

    const subject = screen.getByLabelText('Assunto')
    fireEvent.change(subject, {
      target: { value: '@', selectionStart: 1 },
    })

    expect(await screen.findByText('Contexto customizado')).not.toBeNull()
    expect(screen.queryByText('Pessoas desta página')).toBeNull()
    expect(screen.queryByText('Ana · e-mail')).toBeNull()
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options[0]).toContain('Nome do workspace')
    expect(options[1]).toContain('Título da página')
    expect(options[2]).toContain('Status')
  })

  it('converte a coluna de título mask=email para page.title e lista somente colunas de e-mail', async () => {
    const onSave = vi.fn()
    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      row={{
        id: 'page-1',
        cells: {
          page_title: { value: 'solicitante@example.com' },
          contact: { value: 'contato@example.com' },
        },
      }}
      columns={[
        { id: 'page_title', key: 'title', title: 'E-mail do solicitante', type: 'text', mask: 'email' },
        { id: 'contact', title: 'E-mail de contato', type: 'text', mask: 'email' },
        { id: 'notes', title: 'Observação', type: 'text' },
        column,
      ]}
      onOpenChange={vi.fn()}
      loadMacros={vi.fn().mockResolvedValue([
        { token: '@people.user-1.name', label: 'Ana · nome', group: 'people', valueType: 'text', preview: 'Ana' },
        { token: '@people.user-1.email', label: 'Ana · e-mail', group: 'people', valueType: 'email', preview: 'ana@example.com' },
        { token: '@people.user-2.email', label: 'Bruno · e-mail', group: 'people', valueType: 'email', preview: 'bruno@example.com' },
        { token: '@page.title', label: 'Título da página', group: 'page', valueType: 'text', preview: 'Solicitação 01' },
        { token: '@columns.contact', label: 'E-mail de contato', group: 'columns', valueType: 'email', preview: 'contato@example.com' },
        { token: '@columns.notes', label: 'Observação', group: 'columns', valueType: 'email', preview: 'Texto' },
      ])}
      onSave={onSave}
    />)

    expect(await screen.findByText('Ana')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar destinatário' }))

    const bruno = await screen.findByRole('option', { name: /Bruno/ })
    expect(screen.queryByRole('option', { name: /Ana/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Título da página/ })).toBeNull()
    expect(screen.getByRole('option', { name: /E-mail do solicitante/ })).not.toBeNull()
    expect(screen.getByText('solicitante@example.com')).not.toBeNull()
    expect(screen.getByRole('option', { name: /E-mail de contato/ })).not.toBeNull()
    expect(screen.queryByRole('option', { name: /Observação/ })).toBeNull()
    fireEvent.click(bruno)
    fireEvent.click(screen.getByRole('option', { name: /E-mail do solicitante/ }))
    fireEvent.click(screen.getByRole('option', { name: /E-mail de contato/ }))

    expect(screen.getByText('Bruno')).not.toBeNull()
    expect(screen.queryByRole('option', { name: /Bruno/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar flow' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0]?.[1] as FlowDefinition
    expect(saved.nodes.find((node) => node.type === 'email')?.config.to)
      .toBe('@people.user-1.email, @people.user-2.email, @page.title, @columns.contact')
  })

  it('não oferece page.title quando a coluna de título está sem mask=email', async () => {
    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      columns={[
        { id: 'page_title', key: 'title', title: 'Título da página', type: 'text' },
        { id: 'contact', title: 'Contato sem máscara', type: 'text' },
        column,
      ]}
      onOpenChange={vi.fn()}
      loadMacros={vi.fn().mockResolvedValue([
        { token: '@people.user-1.email', label: 'Ana · e-mail', group: 'people', valueType: 'email' },
        { token: '@people.user-2.email', label: 'Bruno · e-mail', group: 'people', valueType: 'email' },
        { token: '@page.title', label: 'Título da página', group: 'page', valueType: 'email' },
        { token: '@columns.contact', label: 'Contato sem máscara', group: 'columns', valueType: 'email' },
      ])}
      onSave={vi.fn()}
    />)

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar destinatário' }))
    expect(screen.getByRole('option', { name: /Bruno/ })).not.toBeNull()
    expect(screen.queryByRole('option', { name: /Título da página/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /Contato sem máscara/ })).toBeNull()
  })

  it('fecha a lista no blur e não abre quando não restam destinatários', async () => {
    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      columns={[column]}
      onOpenChange={vi.fn()}
      loadMacros={vi.fn().mockResolvedValue([
        { token: '@people.user-1.email', label: 'Ana · e-mail', group: 'people', valueType: 'email' },
      ])}
      onSave={vi.fn()}
    />)

    const add = await screen.findByRole('button', { name: 'Adicionar destinatário' })
    expect((add as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(add)
    expect(screen.queryByLabelText('Buscar destinatário')).toBeNull()
  })

  it('fecha a lista de destinatários ao perder o foco', async () => {
    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      columns={[column]}
      onOpenChange={vi.fn()}
      loadMacros={vi.fn().mockResolvedValue([
        { token: '@people.user-1.email', label: 'Ana · e-mail', group: 'people', valueType: 'email' },
        { token: '@people.user-2.email', label: 'Bruno · e-mail', group: 'people', valueType: 'email' },
      ])}
      onSave={vi.fn()}
    />)

    fireEvent.click(await screen.findByRole('button', { name: 'Adicionar destinatário' }))
    const search = await screen.findByLabelText('Buscar destinatário')
    fireEvent.blur(search, { relatedTarget: null })
    expect(screen.queryByLabelText('Buscar destinatário')).toBeNull()
  })

  it('lista as opções de select e persiste o ID canônico escolhido', async () => {
    const onSave = vi.fn()
    const selectColumn: HeaderCol = {
      id: 'room',
      title: 'Sala',
      type: 'select',
      options: [
        { id: 'room-a', label: 'Sala A' },
        { id: 'room-b', label: 'Sala B' },
      ],
    }

    render(<FlowEditorDialog
      open
      mode="configure"
      column={{ ...column, flow: setValueFlow('room') }}
      columns={[column, selectColumn]}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />)

    expect(screen.queryByPlaceholderText('Valor ou @macro')).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Novo valor' }))
    fireEvent.click(screen.getByRole('option', { name: 'Sala B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar flow' }))

    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0]?.[1] as FlowDefinition
    expect(saved.nodes.find((node) => node.type === 'set_value')?.config.value).toBe('room-b')
  })

  it('edita checkbox como Sim ou Não e não oferece date ou flow como destino', () => {
    const checkboxColumn: HeaderCol = { id: 'approved', title: 'Aprovado', type: 'checkbox' }

    render(<FlowEditorDialog
      open
      mode="configure"
      column={{ ...column, flow: setValueFlow('approved') }}
      columns={[
        column,
        checkboxColumn,
        { id: 'event-date', title: 'Data', type: 'date' },
      ]}
      onOpenChange={vi.fn()}
      onSave={vi.fn()}
    />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Novo valor' }))
    expect(screen.getByRole('option', { name: 'Sim' })).not.toBeNull()
    expect(screen.getByRole('option', { name: 'Não' })).not.toBeNull()
    fireEvent.click(screen.getByRole('option', { name: 'Sim' }))

    fireEvent.click(screen.getByRole('combobox', { name: 'Propriedade a atualizar' }))
    expect(screen.getByRole('option', { name: 'Aprovado' })).not.toBeNull()
    expect(screen.queryByRole('option', { name: 'Data' })).toBeNull()
    expect(screen.queryByRole('option', { name: 'Aprovação' })).toBeNull()
  })

  it('mantém macros somente no valor de propriedades text', async () => {
    const onSave = vi.fn()
    const textColumn: HeaderCol = { id: 'notes', title: 'Observação', type: 'text' }

    render(<FlowEditorDialog
      open
      mode="configure"
      column={{ ...column, flow: setValueFlow('notes') }}
      columns={[column, textColumn]}
      onOpenChange={vi.fn()}
      loadMacros={vi.fn().mockResolvedValue([
        { token: '@page.title', label: 'Título da página', group: 'page' },
      ])}
      onSave={onSave}
    />)

    const value = screen.getByRole('combobox', { name: 'Novo valor' })
    fireEvent.change(value, { target: { value: '@', selectionStart: 1 } })
    fireEvent.click(await screen.findByRole('option', { name: /Título da página/ }))
    expect((value as HTMLInputElement).value).toBe('@{Titulo_Da_Pagina}')

    fireEvent.click(screen.getByRole('button', { name: 'Salvar flow' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0]?.[1] as FlowDefinition
    expect(saved.nodes.find((node) => node.type === 'set_value')?.config.value).toBe('@page.title')
  })

  it('executa usando apenas as identidades da linha e da coluna', async () => {
    let resolveExecution!: (result: FlowExecutionResult) => void
    const execution: FlowExecutionResult = {
      executionId: 'execution-1',
      status: 'succeeded',
      startedAt: '2026-09-30T10:00:00.000Z',
      finishedAt: '2026-09-30T10:00:01.000Z',
      executedNodeIds: ['start', 'email', 'callback'],
      callback: 'Concluído',
      effects: { emailsQueued: 1, valuesUpdated: 0 },
    }
    const onExecute = vi.fn().mockReturnValue(new Promise<FlowExecutionResult>((resolve) => {
      resolveExecution = resolve
    }))

    render(<FlowEditorDialog
      open
      mode="execute"
      column={column}
      row={row}
      columns={[column]}
      onOpenChange={vi.fn()}
      onExecute={onExecute}
    />)

    fireEvent.click(screen.getByRole('button', { name: 'Executar' }))

    const pendingButton = screen.getByRole('button', { name: 'Executando…' })
    expect(pendingButton.className).toContain('shadow-p-purple-500/30')

    await waitFor(() => expect(onExecute).toHaveBeenCalledWith({
      columnId: 'flow-column',
      rowId: 'page-1',
    }))
    resolveExecution(execution)
    expect(await screen.findByText('Flow executado')).not.toBeNull()
    expect(screen.getByText('3 etapa(s) · 0 valor(es) atualizado(s) · 1 e-mail(s) enfileirado(s)')).not.toBeNull()
    expect(screen.getByText('E-mail enfileirado. A execução terminou, mas o envio ainda não foi confirmado.')).not.toBeNull()
  })
})
