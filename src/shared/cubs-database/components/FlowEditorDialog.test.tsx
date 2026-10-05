import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { FlowDefinition, FlowExecutionResult, FlowStepV2, HeaderCol, RowData } from '../types'
import { moveFlowStep } from '../flowTree'
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
  it('preserva o rascunho ao atualizar o botão e aplica bloqueio com o painel aberto', async () => {
    const onSave = vi.fn()
    const onButtonChange = vi.fn()
    const props = { open: true, mode: 'configure' as const, column, columns: [column], onOpenChange: vi.fn(), onSave, onButtonChange }
    const view = render(<FlowEditorDialog {...props} />)
    fireEvent.change(screen.getByLabelText('Assunto'), { target: { value: 'Rascunho preservado' } })
    fireEvent.change(screen.getByLabelText('Texto do botão Flow'), { target: { value: 'Aprovar' } })
    fireEvent.blur(screen.getByLabelText('Texto do botão Flow'))
    expect(onButtonChange).toHaveBeenCalledWith(column.id, { flowButton: { label: 'Aprovar', icon: 'lucide:play' } })
    const updated = { ...column, flowButton: { label: 'Aprovar', icon: 'lucide:play' } }
    view.rerender(<FlowEditorDialog {...props} column={updated} columns={[updated]} />)
    expect((screen.getByLabelText('Assunto') as HTMLInputElement).value).toBe('Rascunho preservado')
    view.rerender(<FlowEditorDialog {...props} column={updated} columns={[updated]} readOnly />)
    expect(screen.queryByLabelText('Assunto')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar flow' })).toBeNull()
    expect((screen.getByRole('button', { name: 'Executar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('arrasta pelo card inteiro, reserva seu tamanho e restaura o card ao cancelar', async () => {
    const onOpenChange = vi.fn()
    render(<FlowEditorDialog
      open
      mode="configure"
      column={column}
      columns={[column]}
      onOpenChange={onOpenChange}
      onSave={vi.fn()}
    />)

    expect(screen.queryByLabelText('Reordenar ação')).toBeNull()
    expect(screen.queryByText('Solte uma ação aqui')).toBeNull()
    const card = screen.getByRole('group', { name: 'Enviar e-mail arrastável' })
    expect(card.className).toContain('cursor-grab')
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 620, 216))

    card.focus()
    fireEvent.keyDown(card, { key: ' ', code: 'Space' })
    await waitFor(() => expect(document.querySelector('[data-flow-drag-overlay]')).not.toBeNull())
    expect(document.querySelector('[data-flow-drag-overlay]')?.className).toContain('border-p-purple-500/55')
    expect(card.querySelector('[data-drag-placeholder]')).not.toBeNull()
    expect(card.style.width).toBe('620px')
    expect(card.style.height).toBe('216px')
    fireEvent.keyDown(card, { key: 'Escape', code: 'Escape' })
    await waitFor(() => expect(card.querySelector('[data-drag-placeholder]')).toBeNull())
    expect(card.style.width).toBe('')
    expect(card.style.height).toBe('')
    expect(document.querySelector('[data-flow-drag-overlay]')).toBeNull()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('move uma condição com a subárvore entre os ramos', () => {
    const steps: FlowStepV2[] = [{
      id: 'parent',
      type: 'switch',
      config: {
        columnId: 'page_title', operator: 'contains', value: 'Reserva',
        whenTrue: [{
          id: 'nested', type: 'switch', config: {
            columnId: 'page_title', operator: 'contains', value: 'Professor',
            whenTrue: [{ id: 'email', type: 'email', config: { to: '@page.title', subject: 'Oi', body: 'Oi' } }],
            whenFalse: [],
          },
        }],
        whenFalse: [],
      },
    }]

    const moved = moveFlowStep(steps, 'nested', 'drop:parent:false')
    const parent = moved[0]
    expect(parent?.type).toBe('switch')
    if (parent?.type !== 'switch') throw new Error('Condição pai ausente')
    expect(parent.config.whenTrue).toEqual([])
    expect(parent.config.whenFalse[0]).toMatchObject({ id: 'nested', type: 'switch' })
    const nested = parent.config.whenFalse[0]
    if (nested?.type !== 'switch') throw new Error('Condição aninhada ausente')
    expect(nested.config.whenTrue[0]?.id).toBe('email')
  })

  it('reserva espaço num ramo vazio e salva a ação nesse ramo após o drop', async () => {
    const onSave = vi.fn()
    const branchingFlow: FlowDefinition = {
      version: 2,
      trigger: { type: 'manual' },
      nodes: [
        { id: 'start', type: 'start', config: {} },
        { id: 'email', type: 'email', config: { to: '@page.title', subject: 'Oi', body: 'Oi' } },
        { id: 'condition', type: 'switch', config: { columnId: 'page_title', operator: 'contains', value: 'Oi', whenTrue: [], whenFalse: [] } },
        { id: 'callback', type: 'callback', config: {} },
      ],
    }
    render(<FlowEditorDialog open mode="configure" column={{ ...column, flow: branchingFlow }} columns={[column]} onOpenChange={vi.fn()} onSave={onSave} />)
    const card = screen.getByRole('group', { name: 'Enviar e-mail arrastável' })
    const branch = screen.getByRole('button', { name: /Se sim/ }).parentElement!.querySelector<HTMLElement>('div')!
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 620, 216))
    vi.spyOn(branch, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 300, 600, 80))
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: 10, clientY: 10,
    })
    Object.defineProperties(pointerDown, { isPrimary: { value: true }, pointerId: { value: 1 } })
    fireEvent(card, pointerDown)
    fireEvent(document, new MouseEvent('pointermove', {
      bubbles: true, cancelable: true, buttons: 1, clientX: 10, clientY: 20,
    }))
    await waitFor(() => expect(document.querySelector('[data-flow-drag-overlay]')).not.toBeNull())
    fireEvent(document, new MouseEvent('pointermove', {
      bubbles: true, cancelable: true, buttons: 1, clientX: 100, clientY: 330,
    }))
    await waitFor(() => expect(branch.querySelector('[data-drag-placeholder]')).not.toBeNull())
    expect(branch.querySelector('[data-drag-placeholder]')!.parentElement!.style.height).toBe('216px')
    fireEvent(document, new MouseEvent('pointerup', {
      bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: 330,
    }))
    await waitFor(() => expect(within(branch).getByRole('group', { name: 'Enviar e-mail arrastável' })).not.toBeNull())
    expect(document.querySelector('[data-drag-placeholder]')).toBeNull()
    // O PointerSensor retém o click pós-drop por 50ms.
    await new Promise((resolve) => setTimeout(resolve, 60))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar flow' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    const saved = onSave.mock.calls[0][1] as FlowDefinition
    expect(saved.nodes.map((node) => node.id)).toEqual(['start', 'condition', 'callback'])
    expect(saved.nodes[1]).toMatchObject({ config: { whenTrue: [{ id: 'email' }] } })
  })

  it('reordena nos dois sentidos usando o índice final do sortable', () => {
    const steps: FlowStepV2[] = [
      { id: 'first', type: 'email', config: { to: '@page.title', subject: '1', body: '1' } },
      { id: 'second', type: 'email', config: { to: '@page.title', subject: '2', body: '2' } },
      { id: 'third', type: 'email', config: { to: '@page.title', subject: '3', body: '3' } },
    ]

    expect(moveFlowStep(steps, 'first', 'third').map((step) => step.id)).toEqual(['second', 'third', 'first'])
    expect(moveFlowStep(steps, 'third', 'first').map((step) => step.id)).toEqual(['third', 'first', 'second'])
  })

  it('cria condição tipada por select, salva o ID e permite condição aninhada no ramo', async () => {
    const onSave = vi.fn()
    const room: HeaderCol = {
      id: 'room', title: 'Sala', type: 'select',
      options: [{ id: 'room-a', label: 'Sala A' }, { id: 'room-b', label: 'Sala B' }],
    }
    render(<FlowEditorDialog open mode="configure" column={{ ...column, flow: undefined }} columns={[column, room]} onOpenChange={vi.fn()} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Condição' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Propriedade da condição' }))
    fireEvent.click(screen.getByRole('option', { name: 'Sala' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Comparar com' }))
    fireEvent.click(screen.getByRole('option', { name: 'Sala B' }))

    const yesBranch = screen.getByRole('button', { name: /Se sim/ }).closest('section')
    expect(yesBranch).not.toBeNull()
    fireEvent.click(within(yesBranch as HTMLElement).getByRole('button', { name: 'Condição' }))
    expect(screen.getAllByRole('combobox', { name: 'Propriedade da condição' })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Propriedade da condição' })[1]!)
    fireEvent.click(screen.getByRole('option', { name: 'Sala' }))
    fireEvent.click(screen.getAllByRole('combobox', { name: 'Comparar com' })[1]!)
    fireEvent.click(screen.getByRole('option', { name: 'Sala A' }))
    expect(screen.getAllByText('Depois da condição')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Salvar flow' }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())
    const saved = onSave.mock.calls[0]?.[1] as Extract<FlowDefinition, { version: 2 }>
    const decision = saved.nodes[1]
    expect(decision?.type).toBe('switch')
    if (decision?.type !== 'switch') throw new Error('Condição não salva')
    expect(decision.config.value).toBe('room-b')
    expect(decision.config.whenTrue[0]?.type).toBe('switch')
  })

  it('mantém condição com opção removida visível e bloqueia o save', () => {
    const invalidFlow: Extract<FlowDefinition, { version: 2 }> = {
      version: 2,
      trigger: { type: 'manual' },
      nodes: [
        { id: 'start', type: 'start', config: {} },
        { id: 'condition', type: 'switch', config: { columnId: 'room', operator: 'equals', value: 'removed', whenTrue: [], whenFalse: [] } },
        { id: 'done', type: 'callback', config: { message: 'Fim' } },
      ],
    }
    render(<FlowEditorDialog open mode="configure" column={{ ...column, flow: invalidFlow }} columns={[column, { id: 'room', title: 'Sala', type: 'select', options: [{ id: 'room-a', label: 'Sala A' }] }]} onOpenChange={vi.fn()} onSave={vi.fn()} />)

    expect(screen.getByRole('alert').textContent).toContain('não existe mais')
    expect((screen.getByRole('button', { name: 'Salvar flow' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('confirma antes de remover uma condição que possui subárvore', () => {
    const nestedFlow: Extract<FlowDefinition, { version: 2 }> = {
      version: 2,
      trigger: { type: 'manual' },
      nodes: [
        { id: 'start', type: 'start', config: {} },
        { id: 'condition', type: 'switch', config: { columnId: 'page_title', operator: 'contains', value: 'Reserva', whenTrue: [{ id: 'email', type: 'email', config: { to: '@page.title', subject: 'Oi', body: 'Oi' } }], whenFalse: [] } },
        { id: 'done', type: 'callback', config: { message: 'Fim' } },
      ],
    }
    render(<FlowEditorDialog open mode="configure" column={{ ...column, flow: nestedFlow }} columns={[column]} onOpenChange={vi.fn()} onSave={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Remover ação' })[0]!)
    expect(screen.getByText('Remover esta condição e toda a subárvore?')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar remoção' }))
    expect(screen.queryByText('Remover esta condição e toda a subárvore?')).toBeNull()
    expect(screen.queryByRole('combobox', { name: 'Propriedade da condição' })).toBeNull()
  })

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
