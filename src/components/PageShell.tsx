import { usePageAccess } from '@/hooks/usePageAccess'
import { displayMentionText } from 'cubs-components'
import { can } from '@/services/AccessService'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  type PageContentView,
  type PageContentViewLabels,
} from '@components/PageContentViewSwitcher'
import {
  PageShellContent,
  type PageContentSlots,
} from '@components/PageShellContent'
import { PageShellHeader } from '@components/PageShellHeader'
import { PageFavoriteButton } from '@components/PageFavoriteButton'
import {
  PageSettingsContent,
  type PageSettingsFragment,
} from '@components/PageSettingsModal'
import { useAuth } from '@/contexts/AuthContext'
import { useModal, type ModalHandle } from '@/hooks/useModal'
import { useOptionalMention } from '@/hooks/useMention'
import { mentionIds, mentionToken } from '@/shared/mentions'
import { usePageRealtime, type UsePageRealtimeOptions } from '@/hooks/usePageRealtime'
import { i18n } from '@/lib/i18n'
import { formatRelativeTime, parseApiTimestamp } from '@/lib/formatRelativeTime'
import type { ApiPage } from '@/lib/databaseParser'
import { assignUserVisualIdentities } from '@/lib/userVisualIdentity'
import { normalizePageTitle } from '@/lib/pageNavigation'
import { databaseService } from '@/services/DatabaseService'
import { pageWriteService } from '@/services/PageWriteService'
import type { DatabaseUpdatedPayload, PageUpdatedPayload } from '@/services/realtime-contract-v1'
import {
  sharedPagesService,
  type ApiPageCollaborator,
} from '@/services/SharedPagesService'
import type { UserIdentity } from '@/types/user'

type PageActivityKind = 'created' | 'updated'

function initialPageActivity(page: ApiPage): { at: string; kind: PageActivityKind } {
  if (page.latest_updated_at) return { at: page.latest_updated_at, kind: 'updated' }
  const createdAt = parseApiTimestamp(page.created_at)?.getTime()
  const updatedAt = parseApiTimestamp(page.updated_at)?.getTime()
  if (createdAt !== undefined && updatedAt !== undefined && createdAt === updatedAt) {
    return { at: page.created_at, kind: 'created' }
  }
  return { at: page.updated_at, kind: 'updated' }
}

function readPageSettingsFragment(hash: string): PageSettingsFragment | null {
  return hash === '#general' || hash === '#collaborators' ? hash : null
}

function urlWithoutHash(): string {
  return `${window.location.pathname}${window.location.search}`
}

export interface PageShellProps extends UsePageRealtimeOptions {
  /** Página aberta, já resolvida pela rota canônica `/page/:id`. */
  pageId: string
  /** Título transportado pela tela anterior; a API continua autoritativa. */
  initialTitle?: string | null
  /** Impede montar o renderer de conteúdo antes de seu snapshot estar pronto. */
  contentLoading?: boolean
  /** Tab de conteúdo controlada pelo host quando ele precisa desmontar dados. */
  contentView?: PageContentView
  onContentViewChange?: (view: PageContentView) => void
  /** Renderers dos recursos da página, indexados pela tab que os apresenta. */
  content?: PageContentSlots
  /** Decisão global de lock-in da coluna sintética `title`. */
  titleReadOnly?: boolean
  pdfAction?: { label: string; onSelect: () => void }
}

/**
 * Moldura padrão de uma página do Cub's: cabeçalho persistente e seletor do
 * conteúdo abaixo dele. Cada recurso entra por um slot tipado, sem acoplar seu
 * renderer ao chrome da página. Toda página aberta no app passa por
 * `/page/:id`; `/workspace/:id` apenas resolve a página inicial e redireciona.
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
  contentView: controlledContentView,
  onContentViewChange,
  content,
  titleReadOnly = false,
  pdfAction,
  ...realtimeOptions
}: PageShellProps) {
  const mentions = useOptionalMention()
  const mentionInput = useMemo(() => mentions ? ({ options: mentions.options.filter((option) => option.id !== `pages:${pageId}:title`), resolve: mentions.resolve, token: mentionToken, label: i18n('mentions.label'), empty: i18n('mentions.empty') }) : undefined, [mentions?.options, mentions?.resolve, pageId])
  const auth = useAuth()
  const permission = usePageAccess(pageId)
  const mayManageMembers = can(permission.data, 'read', 'members') || ['add_members', 'promote_members', 'remove_members'].some((action) => can(permission.data, 'write', action))
  const { openModal } = useModal()
  const pageSettingsModalRef = useRef<ModalHandle | null>(null)
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false)
  const [title, setTitle] = useState<string | null>(() => normalizePageTitle(initialTitle))
  const [draftTitle, setDraftTitle] = useState(() => normalizePageTitle(initialTitle) ?? '')
  const [titleSaving, setTitleSaving] = useState(false)
  const [titleSaveFailed, setTitleSaveFailed] = useState(false)
  const [titlePageId, setTitlePageId] = useState(pageId)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [activityKind, setActivityKind] = useState<PageActivityKind | null>(null)
  const [pageLoading, setPageLoading] = useState(Boolean(pageId))
  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now())
  const [internalContentView, setInternalContentView] = useState<PageContentView>('files')
  const contentView = controlledContentView ?? internalContentView
  const changeContentView = useCallback((next: PageContentView) => {
    if (controlledContentView === undefined) setInternalContentView(next)
    onContentViewChange?.(next)
  }, [controlledContentView, onContentViewChange])
  const [failed, setFailed] = useState(false)
  const [collaborators, setCollaborators] = useState<ApiPageCollaborator[]>([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false)
  const [collaboratorsRevision, setCollaboratorsRevision] = useState(0)
  const titleClockRef = useRef<{ pageId: string | undefined; updatedAt: string | null }>({
    pageId,
    updatedAt: null,
  })
  const databaseClockRef = useRef<{ pageId: string | undefined; updatedAt: string | null }>({
    pageId,
    updatedAt: null,
  })
  const cancelTitleBlurRef = useRef(false)
  const titleSaveRequestRef = useRef({ pageId, sequence: 0 })
  if (titleClockRef.current.pageId !== pageId) {
    titleClockRef.current = { pageId, updatedAt: null }
  }
  if (databaseClockRef.current.pageId !== pageId) {
    databaseClockRef.current = { pageId, updatedAt: null }
  }
  if (titleSaveRequestRef.current.pageId !== pageId) {
    titleSaveRequestRef.current = { pageId, sequence: titleSaveRequestRef.current.sequence }
  }
  const notifyPageUpdated = realtimeOptions.onPageUpdated

  const applyUpdatedActivity = useCallback((candidate: string) => {
    const appliedAt = databaseClockRef.current.updatedAt
    const appliedTime = appliedAt === null ? null : parseApiTimestamp(appliedAt)?.getTime()
    const candidateTime = parseApiTimestamp(candidate)?.getTime()
    if (
      appliedTime !== null
      && appliedTime !== undefined
      && candidateTime !== undefined
      && appliedTime > candidateTime
    ) return
    databaseClockRef.current.updatedAt = candidate
    setUpdatedAt(candidate)
    setActivityKind('updated')
  }, [])

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
      setDraftTitle(normalizePageTitle(payload.title) ?? '')
      setTitleSaveFailed(false)
      setFailed(false)
      applyUpdatedActivity(payload.updatedAt)
      notifyPageUpdated?.(payload)
    },
    [applyUpdatedActivity, notifyPageUpdated, pageId],
  )

  const handleDatabaseUpdated = useCallback((payload: DatabaseUpdatedPayload) => {
    if (payload.pageId !== pageId) return
    applyUpdatedActivity(payload.updatedAt)
  }, [applyUpdatedActivity, pageId])

  // Os handlers vêm de quem tem o ESTADO da base (o `usePageDatabase` da
  // página) — o shell é quem assina a sala, mas não é quem guarda os dados.
  const { viewers } = usePageRealtime(pageId, {
    ...realtimeOptions,
    onPageUpdated: handlePageUpdated,
    onDatabaseUpdated: handleDatabaseUpdated,
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
  const contentViewLabels = useMemo<PageContentViewLabels>(
    () => ({
      navigation: i18n('pages.app.pagina.views.navigation'),
      files: i18n('pages.app.pagina.views.files'),
      document: i18n('pages.app.pagina.views.document.label'),
    }),
    [],
  )
  // A troca de rota renderiza antes de o effect anterior limpar seu estado.
  // Escopar o chrome pelo id impede um único frame com o título da página velha.
  const titleBelongsToPage = titlePageId === pageId
  const displayedTitle = titleBelongsToPage ? title : normalizePageTitle(initialTitle)
  useEffect(() => { if (displayedTitle) mentions?.register(mentionIds(displayedTitle)) }, [displayedTitle, mentions?.register])
  const displayedUpdatedAt = titleBelongsToPage ? updatedAt : null
  const displayedActivityKind = titleBelongsToPage ? activityKind : null
  const displayedFailed = titleBelongsToPage ? failed : false
  const showContentSkeleton = !titleBelongsToPage || (contentLoading ?? pageLoading)
  const activityLabel = useMemo(() => {
    if (!displayedUpdatedAt || !displayedActivityKind) return null
    const relative = formatRelativeTime(displayedUpdatedAt, relativeTimeNow)
    const key = displayedActivityKind === 'created'
      ? 'pages.app.pagina.created-at'
      : 'pages.app.pagina.updated-at'
    return relative ? i18n(key, { relative }) : null
  }, [displayedActivityKind, displayedUpdatedAt, relativeTimeNow])

  const saveTitle = useCallback(async () => {
    if (!pageId || titleSaving || titleReadOnly) return
    if (cancelTitleBlurRef.current) {
      cancelTitleBlurRef.current = false
      return
    }
    const nextTitle = normalizePageTitle(draftTitle)
    if (nextTitle === displayedTitle) return
    const request = ++titleSaveRequestRef.current.sequence
    const titleClockAtStart = titleClockRef.current.updatedAt
    setTitleSaving(true)
    setTitleSaveFailed(false)
    try {
      const saved = await pageWriteService.updateTitle(pageId, nextTitle)
      if (titleSaveRequestRef.current.pageId !== pageId || titleSaveRequestRef.current.sequence !== request || titleClockRef.current.updatedAt !== titleClockAtStart) return
      const confirmed = normalizePageTitle(saved.title)
      setTitle(confirmed)
      setDraftTitle(confirmed ?? '')
    } catch {
      if (titleSaveRequestRef.current.pageId !== pageId || titleSaveRequestRef.current.sequence !== request) return
      setDraftTitle(displayedTitle ?? '')
      setTitleSaveFailed(true)
    } finally {
      if (titleSaveRequestRef.current.pageId === pageId && titleSaveRequestRef.current.sequence === request) setTitleSaving(false)
    }
  }, [displayedTitle, draftTitle, pageId, titleReadOnly, titleSaving])

  const cancelTitleEdit = useCallback((cancelBlur: boolean) => {
    cancelTitleBlurRef.current = cancelBlur
    setDraftTitle(displayedTitle ?? '')
  }, [displayedTitle])

  const openPageSettings = useCallback(
    (fragment: PageSettingsFragment) => {
      pageSettingsModalRef.current?.closeModal()
      if (window.location.hash !== fragment) window.location.hash = fragment
      setPageSettingsOpen(true)
      pageSettingsModalRef.current = openModal({
        size: 'xl',
        className: 'p-0',
        onClose: () => {
          pageSettingsModalRef.current = null
          setPageSettingsOpen(false)
          if (readPageSettingsFragment(window.location.hash)) {
            window.history.replaceState(window.history.state, '', urlWithoutHash())
          }
        },
        content: <PageSettingsContent
          initialFragment={fragment}
          onFragmentChange={(next) => {
            if (window.location.hash !== next) window.location.hash = next
          }}
          pageId={pageId}
          pageTitle={displayedTitle}
          showCollaborators={mayManageMembers}
          pdfAction={pdfAction && { label: pdfAction.label, onSelect: () => {
            pageSettingsModalRef.current?.closeModal()
            pdfAction.onSelect()
          } }}
          onMembersChanged={() => setCollaboratorsRevision((revision) => revision + 1)}
        />,
      })
    },
    [displayedTitle, openModal, pageId, mayManageMembers, pdfAction],
  )

  // Deep-link real: carregar, navegar por back/forward ou escrever o hash
  // diretamente abre a seção correspondente.
  useEffect(() => {
    const syncFromHash = () => {
      const fragment = readPageSettingsFragment(window.location.hash)
      if (fragment) {
        if (!pageSettingsModalRef.current) openPageSettings(fragment)
      } else {
        pageSettingsModalRef.current?.closeModal()
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [openPageSettings])

  // O flag `active` descarta a resposta de um unmount no meio do caminho —
  // sem ele, o setState cai num componente que já saiu da árvore.
  useEffect(() => {
    setTitlePageId(pageId)
    setTitle(normalizePageTitle(initialTitle))
    setDraftTitle(normalizePageTitle(initialTitle) ?? '')
    setTitleSaving(false)
    setTitleSaveFailed(false)
    setUpdatedAt(null)
    setActivityKind(null)
    setFailed(false)
    setPageLoading(Boolean(pageId))
    if (!pageId) return
    let active = true
    const titleClockAtStart = titleClockRef.current.updatedAt
    const databaseClockAtStart = databaseClockRef.current.updatedAt

    databaseService
      .getPage(pageId)
      .then((page) => {
        // Um `page-updated` posterior ao início do fetch é mais novo que a
        // resposta potencialmente stale e não pode ser desfeito por ela.
        if (!active) return
        if (titleClockRef.current.updatedAt === titleClockAtStart) {
          setTitlePageId(pageId)
          setTitle(normalizePageTitle(page.title))
          setDraftTitle(normalizePageTitle(page.title) ?? '')
        }
        if (databaseClockRef.current.updatedAt === databaseClockAtStart) {
          const activity = initialPageActivity(page)
          setUpdatedAt(activity.at)
          setActivityKind(activity.kind)
          databaseClockRef.current.updatedAt = activity.at
        }
      })
      .catch(() => {
        if (active && titleClockRef.current.updatedAt === titleClockAtStart) {
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
      return
    }
    let active = true
    setCollaborators([])
    setCollaboratorsLoading(true)
    sharedPagesService
      .listCollaborators(pageId)
      .then((loaded) => {
        if (active) setCollaborators(loaded)
      })
      .catch(() => {
        if (active) setCollaborators([])
      })
      .finally(() => {
        if (active) setCollaboratorsLoading(false)
      })
    return () => {
      active = false
    }
  }, [pageId, collaboratorsRevision])

  return (
    <div className="mx-auto my-0 w-full max-w-6xl p-4">
      <PageShellHeader
        actions={<PageFavoriteButton pageId={pageId} title={displayMentionText(displayedTitle ?? '', mentions?.resolve, i18n('mentions.unavailable'))} enabled={!pageLoading && !displayedFailed} />}
        mentions={mentionInput}
        title={displayedTitle}
        draftTitle={draftTitle}
        loading={pageLoading}
        failed={displayedFailed}
        editable={can(permission.data, 'write', 'update')}
        readOnly={titleReadOnly}
        saving={titleSaving}
        saveFailed={titleSaveFailed}
        activityLabel={activityLabel}
        activityAt={displayedUpdatedAt}
        contentView={contentView}
        contentViewLabels={contentViewLabels}
        participants={visualParticipants}
        currentUserId={auth.user?.id}
        viewers={viewers}
        collaboratorsLoading={collaboratorsLoading}
        settingsOpen={pageSettingsOpen}
        onDraftTitleChange={setDraftTitle}
        onSaveTitle={() => void saveTitle()}
        onCancelTitle={cancelTitleEdit}
        onContentViewChange={changeContentView}
        onOpenCollaborators={
          mayManageMembers || pdfAction
            ? () => openPageSettings(mayManageMembers ? '#collaborators' : '#general')
            : undefined
        }
      />

      <PageShellContent view={contentView} loading={showContentSkeleton} slots={content} />
    </div>
  )
}
