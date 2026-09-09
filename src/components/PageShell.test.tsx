import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import type { ApiPage } from '@/lib/databaseParser'
import type { AuthUser } from '@/services/AuthService'
import type { ApiPageCollaborator } from '@/services/SharedPagesService'
import { PageShell } from './PageShell'

const dependencies = vi.hoisted(() => ({
  getPage: vi.fn(),
  listCollaborators: vi.fn(),
  listCollaboratorCandidates: vi.fn(),
  addCollaborator: vi.fn(),
  options: undefined as UsePageRealtimeOptions | undefined,
  user: {
    id: 'user-current',
    name: 'Pessoa Atual',
    email: 'atual@cubs.test',
  } as AuthUser | null,
}))

vi.mock('@/hooks/usePageRealtime', () => ({
  usePageRealtime: (_pageId: string | undefined, options: UsePageRealtimeOptions) => {
    dependencies.options = options
    return { viewers: 2, joined: true }
  },
}))

vi.mock('@/services/DatabaseService', () => ({
  databaseService: { getPage: dependencies.getPage },
}))

vi.mock('@/services/SharedPagesService', () => ({
  sharedPagesService: {
    listCollaborators: dependencies.listCollaborators,
    listCollaboratorCandidates: dependencies.listCollaboratorCandidates,
    addCollaborator: dependencies.addCollaborator,
  },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: dependencies.user }),
}))

vi.mock('@/lib/i18n', () => ({ i18n: (key: string) => key }))

const PAGE_ID = '01KXVZ0000PARENT0000000001'

function page(title: string | null, id = PAGE_ID): ApiPage {
  return {
    id,
    title,
    data: null,
    owner_id: '01KXVZ0000USER00000000001',
    updated_at: '2026-08-31 16:00:00',
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(window.history.state, '', window.location.pathname)
  dependencies.options = undefined
  dependencies.user = {
    id: 'user-current',
    name: 'Pessoa Atual',
    email: 'atual@cubs.test',
  }
  dependencies.getPage.mockResolvedValue(page('Título inicial'))
  dependencies.listCollaborators.mockResolvedValue([])
  dependencies.listCollaboratorCandidates.mockResolvedValue([])
  dependencies.addCollaborator.mockResolvedValue(undefined)
})

afterEach(() => cleanup())

describe('PageShell — page-updated', () => {
  it('mostra o updated_at da API e acompanha o timestamp do realtime', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-08-31T18:00:00.000Z').getTime())
    render(<PageShell pageId={PAGE_ID}>conteúdo</PageShell>)

    expect(await screen.findByText('pages.app.pagina.updated-at')).toBeTruthy()
    const initialTime = screen.getByText('pages.app.pagina.updated-at').closest('time')
    expect(initialTime?.getAttribute('datetime')).toBe('2026-08-31 16:00:00')

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Título remoto',
        updatedAt: '2026-08-31T17:58:00.000Z',
        originUserId: 'user-1',
      })
    })
    expect(screen.getByText('pages.app.pagina.updated-at').closest('time')?.getAttribute('datetime')).toBe(
      '2026-08-31T17:58:00.000Z',
    )
  })

  it('atualiza o chrome com guarda própria e aceita empate de timestamp', async () => {
    render(<PageShell pageId={PAGE_ID}>conteúdo</PageShell>)
    await screen.findByText('Título inicial')

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Título remoto',
        updatedAt: '2026-08-30T12:00:00.123Z',
        originUserId: 'user-1',
      })
    })
    expect(screen.getByText('Título remoto')).toBeTruthy()

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: '01KXVZ0000PARENT0000000002',
        title: 'Outra página',
        updatedAt: '2026-08-30T13:00:00.000Z',
        originUserId: 'user-2',
      })
    })
    expect(screen.queryByText('Outra página')).toBeNull()

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Evento atrasado',
        updatedAt: '2026-08-30T11:59:59.999Z',
        originUserId: 'user-2',
      })
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Segundo no mesmo milissegundo',
        updatedAt: '2026-08-30T12:00:00.123Z',
        originUserId: 'user-3',
      })
    })

    expect(screen.queryByText('Evento atrasado')).toBeNull()
    expect(screen.getByText('Segundo no mesmo milissegundo')).toBeTruthy()
  })

  it('não deixa um fetch iniciado antes apagar um page-updated mais novo', async () => {
    const request = deferred<ApiPage>()
    dependencies.getPage.mockReturnValueOnce(request.promise)
    render(<PageShell pageId={PAGE_ID} />)

    act(() => {
      dependencies.options?.onPageUpdated?.({
        pageId: PAGE_ID,
        title: 'Autoritativo do socket',
        updatedAt: '2026-08-30T12:00:00.000Z',
        originUserId: 'user-1',
      })
    })
    expect(screen.getByText('Autoritativo do socket')).toBeTruthy()

    await act(async () => request.resolve(page('Snapshot stale')))
    await waitFor(() => expect(screen.queryByText('Snapshot stale')).toBeNull())
    expect(screen.getByText('Autoritativo do socket')).toBeTruthy()
  })
})

describe('PageShell — carregamento inicial', () => {
  it('mostra o título transportado imediatamente e segura o conteúdo no skeleton', async () => {
    const request = deferred<ApiPage>()
    dependencies.getPage.mockReturnValueOnce(request.promise)

    const { rerender } = render(
      <PageShell pageId={PAGE_ID} initialTitle="Título transportado" contentLoading>
        conteúdo autoritativo
      </PageShell>,
    )

    expect(screen.getByRole('heading', { name: 'Título transportado' })).toBeTruthy()
    expect(document.querySelector('[data-page-title-skeleton]')).toBeNull()
    expect(document.querySelector('[data-page-content-skeleton]')).toBeTruthy()
    expect(screen.queryByText('conteúdo autoritativo')).toBeNull()

    rerender(
      <PageShell pageId={PAGE_ID} initialTitle="Título transportado" contentLoading={false}>
        conteúdo autoritativo
      </PageShell>,
    )
    expect(screen.getByText('conteúdo autoritativo')).toBeTruthy()

    await act(async () => request.resolve(page('Título resgatado')))
    expect(await screen.findByRole('heading', { name: 'Título resgatado' })).toBeTruthy()
  })

  it('usa skeleton de largura total no título e no conteúdo quando não recebeu title', () => {
    dependencies.getPage.mockReturnValueOnce(new Promise<ApiPage>(() => undefined))
    dependencies.listCollaborators.mockReturnValueOnce(
      new Promise<ApiPageCollaborator[]>(() => undefined),
    )

    render(
      <PageShell pageId={PAGE_ID} contentLoading>
        conteúdo prematuro
      </PageShell>,
    )

    const titleSkeleton = document.querySelector('[data-page-title-skeleton]')
    expect(titleSkeleton).toBeTruthy()
    expect(titleSkeleton?.className).toContain('relative')
    expect(titleSkeleton?.className).toContain('w-full')
    expect(titleSkeleton?.className).toContain('py-1')
    expect(document.querySelector('[data-page-content-skeleton]')).toBeTruthy()
    expect(screen.queryByText('pages.app.pagina.sem-titulo')).toBeNull()
    expect(screen.queryByText('conteúdo prematuro')).toBeNull()
  })

  it('troca o título provisório pelo skeleton quando a API confirma title ausente', async () => {
    const request = deferred<ApiPage>()
    dependencies.getPage.mockReturnValueOnce(request.promise)

    render(<PageShell pageId={PAGE_ID} initialTitle="Título provisório" />)
    expect(screen.getByRole('heading', { name: 'Título provisório' })).toBeTruthy()

    await act(async () => request.resolve(page(null)))
    await waitFor(() =>
      expect(document.querySelector('[data-page-title-skeleton]')).toBeTruthy(),
    )
    expect(screen.queryByText('Título provisório')).toBeNull()
  })
})

describe('PageShell — visualizações de conteúdo', () => {
  it('mantém a base ativa e troca somente o conteúdo abaixo do shell', async () => {
    render(<PageShell pageId={PAGE_ID}>base atual</PageShell>)
    await screen.findByText('Título inicial')

    expect(screen.getByText('base atual')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'pages.app.pagina.views.files' }).getAttribute('aria-selected')).toBe('true')

    fireEvent.click(screen.getByRole('tab', { name: 'pages.app.pagina.views.document.label' }))
    expect(screen.queryByText('base atual')).toBeNull()
    expect(screen.getByText('pages.app.pagina.views.document.title')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'pages.app.pagina.views.workflow.label' }))
    expect(screen.getByText('pages.app.pagina.views.workflow.title')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'pages.app.pagina.views.files' }))
    expect(screen.getByText('base atual')).toBeTruthy()
  })
})

describe('PageShell — colaboradores e deep-link', () => {
  it('compõe usuário atual primeiro, deduplica vínculos e abre #collaborators', async () => {
    const collaborator: ApiPageCollaborator = {
      id: 'user-other',
      name: 'Outra Pessoa',
      email: 'outra@cubs.test',
    }
    dependencies.listCollaborators.mockResolvedValue([
      dependencies.user!,
      collaborator,
      collaborator,
    ])
    render(<PageShell pageId={PAGE_ID} />)

    const trigger = await screen.findByRole('button', {
      name: 'pages.app.page-settings.open-collaborators',
    })
    await waitFor(() => expect(trigger.dataset.participants).toBe('2'))
    expect(screen.getAllByRole('img')[0].getAttribute('aria-label')).toBe('Pessoa Atual')

    fireEvent.click(trigger)
    expect(window.location.hash).toBe('#collaborators')
    const dialog = await screen.findByRole('dialog', {
      name: 'pages.app.page-settings.title',
    })
    expect(within(dialog).getAllByRole('img')).toHaveLength(2)
    expect(within(dialog).getAllByText('Pessoa Atual')).toHaveLength(1)
    expect(within(dialog).getAllByText('Outra Pessoa')).toHaveLength(1)
  })

  it('carrega #collaborators diretamente e ao fechar remove somente seu fragmento', async () => {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}#collaborators`,
    )
    render(<PageShell pageId={PAGE_ID} />)

    await screen.findByRole('dialog', { name: 'pages.app.page-settings.title' })
    fireEvent.click(screen.getByRole('button', { name: 'common.fechar' }))
    expect(window.location.hash).toBe('')
  })

  it('reage a hashchange sem apagar fragmento que pertence a outra interface', async () => {
    render(<PageShell pageId={PAGE_ID} />)
    act(() => {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}#collaborators`,
      )
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await screen.findByRole('dialog', { name: 'pages.app.page-settings.title' })

    act(() => {
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}#profile`,
      )
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'pages.app.page-settings.title' })).toBeNull(),
    )
    expect(window.location.hash).toBe('#profile')
  })

  it('descarta a resposta de colaboradores da página anterior', async () => {
    const first = deferred<ApiPageCollaborator[]>()
    const newer: ApiPageCollaborator = {
      id: 'user-new',
      name: 'Pessoa Nova',
      email: 'nova@cubs.test',
    }
    const stale: ApiPageCollaborator = {
      id: 'user-old',
      name: 'Pessoa Antiga',
      email: 'antiga@cubs.test',
    }
    dependencies.listCollaborators
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce([newer])
    dependencies.getPage
      .mockResolvedValueOnce(page('Página antiga'))
      .mockResolvedValueOnce(page('Página nova', 'page-2'))

    const { rerender } = render(<PageShell pageId={PAGE_ID} />)
    rerender(<PageShell pageId="page-2" />)
    await screen.findByRole('img', { name: 'Pessoa Nova' })

    await act(async () => first.resolve([stale]))
    expect(screen.queryByRole('img', { name: 'Pessoa Antiga' })).toBeNull()
    expect(screen.getByRole('img', { name: 'Pessoa Nova' })).toBeTruthy()
  })
})
