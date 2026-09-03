import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { Collaborators } from '@components/Collaborators'
import {
  PageContentViewSwitcher,
  type PageContentView,
  type PageContentViewLabels,
} from '@components/PageContentViewSwitcher'
import {
  PageSettingsModal,
  type PageSettingsFragment,
} from '@components/PageSettingsModal'
import { PageTitleSkeleton } from '@components/PageTitleSkeleton'
import { Typography } from '@components/Typography'
import { useAuth } from '@/contexts/AuthContext'
import { useDialog } from '@/hooks/useDialog'
import { usePageRealtime, type UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import { i18n } from '@/lib/i18n'
import { formatRelativeTime } from '@/lib/formatRelativeTime'
import { assignUserVisualIdentities } from '@/lib/userVisualIdentity'
import { normalizePageTitle } from '@/lib/pageNavigation'
import { databaseService } from '@/services/DatabaseService'
import type { PageUpdatedPayload } from '@/services/realtime-contract-v1'
import {
  sharedPagesService,
  type ApiPageCollaborator,
} from '@/services/SharedPagesService'
import type { UserIdentity } from '@/types/user'
import { Icon } from '@iconify/react'

const DEFAULT_PAGE_SETTINGS_FRAGMENT: PageSettingsFragment = '#general'

function readPageSettingsFragment(hash: string): PageSettingsFragment | null {
  return hash === '#general' || hash === '#collaborators' ? hash : null
}

function urlWithoutHash(): string {
  return `${window.location.pathname}${window.location.search}`
}

function PageContentPlaceholder({ view }: { view: Exclude<PageContentView, 'files'> }) {
  const icon = view === 'document' ? 'lucide:file-text' : 'lucide:workflow'
  return (
    <section
      id={`page-content-${view}`}
      role="tabpanel"
      aria-labelledby={`page-content-tab-${view}`}
      className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-divider bg-contrast/40 px-6 text-center"
    >
      <span className="mb-3 rounded-xl bg-active p-3 text-dark-100 dark:text-light-900">
        <Icon icon={icon} fontSize={28} aria-hidden="true" />
      </span>
      <Typography variant="h3">
        {i18n(`pages.app.pagina.views.${view}.title`)}
      </Typography>
      <Typography variant="subtitle" className="mt-1 max-w-md">
        {i18n(`pages.app.pagina.views.${view}.description`)}
      </Typography>
    </section>
  )
}

function PageContentSkeleton({ view }: { view: PageContentView }) {
  return (
    <div
      id={`page-content-${view}`}
      role="tabpanel"
      aria-labelledby={`page-content-tab-${view}`}
      aria-busy="true"
      data-page-content-skeleton
      className="relative w-full pb-6"
    >
      <div aria-hidden="true" className="w-full space-y-3">
        <div className="h-8 w-48 max-w-full animate-pulse rounded-lg bg-active" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-active" />
        <div className="overflow-hidden rounded-xl border border-divider">
          {[0, 1, 2, 3].map((row) => (
            <div
              key={row}
              className="flex h-10 w-full items-center border-b border-divider px-3 last:border-b-0"
            >
              <span className="block h-3 w-full animate-pulse rounded bg-active" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export interface PageShellProps extends UsePageRealtimeOptions {
  /** Página aberta. `undefined` = ainda resolvendo (ex.: a entrada da workspace). */
  pageId?: string
  /** Título transportado pela tela anterior; a API continua autoritativa. */
  initialTitle?: string | null
  /** Impede montar o renderer de conteúdo antes de seu snapshot estar pronto. */
  contentLoading?: boolean
  /** Conteúdo da visualização de base, exibido quando `files` está ativo. */
  children?: ReactNode
}

/**
 * Moldura padrão de uma página do Cub's: cabeçalho persistente e seletor do
 * conteúdo abaixo dele. `files` renderiza `children`; documento e workflow já
 * têm seus pontos de montagem sem acoplar esses renderers ao chrome da página.
 * Toda página aberta no app passa por aqui — pela workspace
 * (`/myworkspace/:id`, que resolve a página de entrada) ou direto pelo id
 * (`/page/:id`, o caminho dos cards de "Colaborando").
 *
 * É também o ÚNICO lugar que entra na sala de realtime (`usePageRealtime`), e
 * isso é de propósito: entrar na sala vira consequência de ABRIR A PÁGINA, não
 * um passo que cada tela precisa lembrar de dar. Como a sala é identificada
 * pelo `pageId`, os dois caminhos de entrada caem na mesma — que é o que faz
 * dono e colaborador se enxergarem editando.
 */
export function PageShell({
  pageId,
  initialTitle,
  contentLoading,
  children,
  ...realtimeOptions
}: PageShellProps) {
  const auth = useAuth()
  const {
    isOpen: pageSettingsOpen,
    openDialog: openPageSettingsDialog,
    closeDialog: closePageSettingsDialog,
  } = useDialog()
  const [title, setTitle] = useState<string | null>(() => normalizePageTitle(initialTitle))
  const [titlePageId, setTitlePageId] = useState(pageId)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [pageLoading, setPageLoading] = useState(Boolean(pageId))
  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now())
  const [contentView, setContentView] = useState<PageContentView>('files')
  const [failed, setFailed] = useState(false)
  const [collaborators, setCollaborators] = useState<ApiPageCollaborator[]>([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false)
  const [collaboratorsFailed, setCollaboratorsFailed] = useState(false)
  const [pageSettingsFragment, setPageSettingsFragment] = useState<PageSettingsFragment>(
    () => readPageSettingsFragment(window.location.hash) ?? DEFAULT_PAGE_SETTINGS_FRAGMENT,
  )
  const titleClockRef = useRef<{ pageId: string | undefined; updatedAt: string | null }>({
    pageId,
    updatedAt: null,
  })
  if (titleClockRef.current.pageId !== pageId) {
    titleClockRef.current = { pageId, updatedAt: null }
  }
  const notifyPageUpdated = realtimeOptions.onPageUpdated

  const handlePageUpdated = useCallback(
    (payload: PageUpdatedPayload) => {
      // Na troca de página há um frame entre render e cleanup do channel
      // anterior. A classe já filtra por room, mas este segundo guard impede
      // que um último evento da página antiga atualize o chrome da nova.
      if (payload.pageId !== pageId) return
      const appliedAt = titleClockRef.current.updatedAt
      // Socket.IO preserva a ordem de emissão no processo único; em empate
      // de milissegundo o segundo evento precisa vencer, como no redutor da base.
      if (appliedAt !== null && appliedAt > payload.updatedAt) return
      titleClockRef.current.updatedAt = payload.updatedAt
      setTitlePageId(payload.pageId)
      setTitle(normalizePageTitle(payload.title))
      setUpdatedAt(payload.updatedAt)
      setFailed(false)
      notifyPageUpdated?.(payload)
    },
    [notifyPageUpdated, pageId],
  )

  // Os handlers vêm de quem tem o ESTADO da base (o `usePageDatabase` da
  // página) — o shell é quem assina a sala, mas não é quem guarda os dados.
  const { viewers } = usePageRealtime(pageId, {
    ...realtimeOptions,
    onPageUpdated: handlePageUpdated,
  })

  // A rota devolve somente vínculos. O usuário autenticado entra primeiro e
  // é removido da lista vinculada quando ele próprio é colaborador da página.
  const linkedCollaborators = useMemo(() => {
    const unique = new Map<string, ApiPageCollaborator>()
    for (const collaborator of collaborators) {
      if (collaborator.id !== auth.user?.id && !unique.has(collaborator.id)) {
        unique.set(collaborator.id, collaborator)
      }
    }
    return [...unique.values()]
  }, [auth.user?.id, collaborators])

  const participants = useMemo<UserIdentity[]>(
    () => (auth.user ? [auth.user, ...linkedCollaborators] : linkedCollaborators),
    [auth.user, linkedCollaborators],
  )
  const visualParticipants = useMemo(
    () => assignUserVisualIdentities(participants),
    [participants],
  )
  const visualCurrentUser = useMemo(
    () => visualParticipants.find((participant) => participant.id === auth.user?.id) ?? null,
    [auth.user?.id, visualParticipants],
  )
  const visualCollaborators = useMemo(
    () => visualParticipants.filter((participant) => participant.id !== auth.user?.id),
    [auth.user?.id, visualParticipants],
  )
  const contentViewLabels = useMemo<PageContentViewLabels>(
    () => ({
      navigation: i18n('pages.app.pagina.views.navigation'),
      files: i18n('pages.app.pagina.views.files'),
      document: i18n('pages.app.pagina.views.document.label'),
      workflow: i18n('pages.app.pagina.views.workflow.label'),
    }),
    [],
  )
  // A troca de rota renderiza antes de o effect anterior limpar seu estado.
  // Escopar o chrome pelo id impede um único frame com o título da página velha.
  const titleBelongsToPage = titlePageId === pageId
  const displayedTitle = titleBelongsToPage ? title : normalizePageTitle(initialTitle)
  const displayedUpdatedAt = titleBelongsToPage ? updatedAt : null
  const displayedFailed = titleBelongsToPage ? failed : false
  const showContentSkeleton = !titleBelongsToPage || (contentLoading ?? pageLoading)
  const updatedAtLabel = useMemo(() => {
    if (!displayedUpdatedAt) return null
    const relative = formatRelativeTime(displayedUpdatedAt, relativeTimeNow)
    return relative ? i18n('pages.app.pagina.updated-at', { relative }) : null
  }, [displayedUpdatedAt, relativeTimeNow])

  const openPageSettings = useCallback(
    (fragment: PageSettingsFragment) => {
      setPageSettingsFragment(fragment)
      openPageSettingsDialog()
      if (window.location.hash !== fragment) window.location.hash = fragment
    },
    [openPageSettingsDialog],
  )

  const handlePageSettingsOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openPageSettingsDialog()
        return
      }
      closePageSettingsDialog()
      // Não apaga fragmentos pertencentes a outra interface.
      if (readPageSettingsFragment(window.location.hash)) {
        window.history.replaceState(window.history.state, '', urlWithoutHash())
      }
    },
    [closePageSettingsDialog, openPageSettingsDialog],
  )

  // Deep-link real: carregar, navegar por back/forward ou escrever o hash
  // diretamente abre a seção correspondente.
  useEffect(() => {
    const syncFromHash = () => {
      const fragment = readPageSettingsFragment(window.location.hash)
      if (fragment) {
        setPageSettingsFragment(fragment)
        openPageSettingsDialog()
      } else {
        closePageSettingsDialog()
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [closePageSettingsDialog, openPageSettingsDialog])

  // O flag `active` descarta a resposta de um unmount no meio do caminho —
  // sem ele, o setState cai num componente que já saiu da árvore.
  useEffect(() => {
    setTitlePageId(pageId)
    setTitle(normalizePageTitle(initialTitle))
    setUpdatedAt(null)
    setFailed(false)
    setPageLoading(Boolean(pageId))
    if (!pageId) return
    let active = true
    const clockAtStart = titleClockRef.current.updatedAt

    databaseService
      .getPage(pageId)
      .then((page) => {
        // Um `page-updated` posterior ao início do fetch é mais novo que a
        // resposta potencialmente stale e não pode ser desfeito por ela.
        if (active && titleClockRef.current.updatedAt === clockAtStart) {
          setTitlePageId(pageId)
          setTitle(normalizePageTitle(page.title))
          setUpdatedAt(page.updated_at)
        }
      })
      .catch(() => {
        if (active && titleClockRef.current.updatedAt === clockAtStart) {
          setFailed(true)
        }
      })
      .finally(() => {
        if (active) setPageLoading(false)
      })

    return () => {
      active = false
    }
  }, [initialTitle, pageId])

  // O rótulo relativo envelhece mesmo quando a página fica aberta sem novos
  // eventos. Um minuto é suficiente para a granularidade exibida no chrome.
  useEffect(() => {
    if (!displayedUpdatedAt) return
    setRelativeTimeNow(Date.now())
    const interval = window.setInterval(() => setRelativeTimeNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [displayedUpdatedAt])

  // Carrega somente os vínculos de acesso. A guarda `active` impede que a
  // resposta de uma página anterior contamine a nova ao navegar rapidamente.
  useEffect(() => {
    if (!pageId) {
      setCollaborators([])
      setCollaboratorsLoading(false)
      setCollaboratorsFailed(false)
      return
    }
    let active = true
    setCollaborators([])
    setCollaboratorsLoading(true)
    setCollaboratorsFailed(false)
    sharedPagesService
      .listCollaborators(pageId)
      .then((loaded) => {
        if (active) setCollaborators(loaded)
      })
      .catch(() => {
        if (active) setCollaboratorsFailed(true)
      })
      .finally(() => {
        if (active) setCollaboratorsLoading(false)
      })
    return () => {
      active = false
    }
  }, [pageId])

  return (
    <div className="mx-auto my-0 w-full max-w-6xl p-4">
      <header className="mb-8 flex flex-col-reverse">
        <Typography
          variant="h1"
          className="w-full flex-1"
          aria-busy={!displayedFailed && displayedTitle === null}
        >
          {displayedFailed ? (
            i18n('pages.app.pagina.indisponivel')
          ) : displayedTitle === null ? (
            <PageTitleSkeleton />
          ) : (
            displayedTitle
          )}
        </Typography>
        <div className="flex items-center justify-between">
          {updatedAtLabel ? (
            <time
              dateTime={displayedUpdatedAt ?? undefined}
              className="text-sm text-dark-100 dark:text-light-900"
            >
              {updatedAtLabel}
            </time>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex items-center gap-3">
            <PageContentViewSwitcher
              value={contentView}
              onValueChange={setContentView}
              labels={contentViewLabels}
            />
            <Collaborators
              participants={visualParticipants}
              currentUserId={auth.user?.id}
              viewers={viewers}
              loading={collaboratorsLoading}
              settingsOpen={pageSettingsOpen}
              onOpenSettings={() => openPageSettings('#collaborators')}
            />
          </div>
        </div>
      </header>

      {showContentSkeleton ? (
        <PageContentSkeleton view={contentView} />
      ) : contentView === 'files' ? (
        <div
          id="page-content-files"
          role="tabpanel"
          aria-labelledby="page-content-tab-files"
        >
          {children}
        </div>
      ) : (
        <PageContentPlaceholder view={contentView} />
      )}

      <PageSettingsModal
        open={pageSettingsOpen}
        onOpenChange={handlePageSettingsOpenChange}
        fragment={pageSettingsFragment}
        onFragmentChange={openPageSettings}
        pageId={pageId}
        pageTitle={displayedTitle}
        currentUser={visualCurrentUser}
        collaborators={visualCollaborators}
        loading={collaboratorsLoading}
        failed={collaboratorsFailed}
      />
    </div>
  )
}
