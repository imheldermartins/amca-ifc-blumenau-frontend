import { Icon } from '@iconify/react'
import { useNavigate } from '@tanstack/react-router'
import { Button, cn } from 'cubs-components'

import { Modal } from '@/components/Modal'
import { useLanguage } from '@/contexts/LanguageContext'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { useNotifications } from '@/hooks/useNotifications'
import { i18n } from '@/lib/i18n'
import { createPageNavigationState } from '@/lib/pageNavigation'
import { THEME } from '@/lib/theme'
import type { NotificationDto } from '@/services/NotificationService'

function text(data: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof data[key] === 'string' ? data[key] as string : fallback
}

function NotificationCard({
  notification,
  pending,
  onRead,
  onDecide,
  onOpenPage,
  locale,
}: {
  notification: NotificationDto
  pending: boolean
  onRead: () => void
  onDecide: (decision: 'accepted' | 'declined') => void
  onOpenPage: (pageId: string, title: string) => void
  locale: string
}) {
  const data = notification.data
  const pageTitle = text(data, 'pageTitle', i18n('pages.app.pagina.sem-titulo'))
  const status = text(data, 'status', 'pending')
  const isRequest = notification.type === 'schedule_pin_request'
  const isFlowEmail = notification.type === 'flow_email'
  const pageId = text(data, 'pageId', notification.resourceType === 'page' ? notification.resourceId : '')
  const requester = text(
    data,
    'requesterName',
    notification.actor?.name || notification.actor?.email || i18n('pages.app.notifications.someone'),
  )
  const createdAt = new Date(notification.createdAt)

  return <article className={cn(
    'rounded-xl border p-3 shadow-sm transition-colors',
    notification.readAt ? 'border-divider bg-background' : 'border-p-purple/30 bg-p-purple/5',
  )}>
    <button type="button" className="flex w-full items-start gap-3 text-left" onClick={onRead}>
      <span className={cn(
        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
        isRequest || isFlowEmail ? 'bg-p-purple/10 text-p-purple' : 'bg-active text-foreground',
      )}>
        <Icon
          icon={isRequest ? 'solar:pin-bold' : isFlowEmail ? 'lucide:workflow' : 'lucide:calendar-clock'}
          className="size-4"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {isRequest
            ? i18n('pages.app.notifications.pin-request-title')
            : isFlowEmail
              ? i18n('pages.app.notifications.flow-email-title')
              : i18n('pages.app.notifications.reminder-title')}
        </span>
        <span className={cn('mt-1 block text-xs leading-5', THEME.textMuted)}>
          {isRequest
            ? i18n('pages.app.notifications.pin-request-description', { requester, page: pageTitle })
            : isFlowEmail
              ? i18n('pages.app.notifications.flow-email-description', { page: pageTitle })
              : i18n('pages.app.notifications.reminder-description', { page: pageTitle })}
        </span>
        {!Number.isNaN(createdAt.getTime()) && <span className={cn('mt-1 block text-[11px]', THEME.textMuted)}>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(createdAt)}
        </span>}
      </span>
      {!notification.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-p-purple" aria-label={i18n('pages.app.notifications.unread')} />}
    </button>
    {isRequest && status === 'pending' && <div className="mt-3 flex justify-end gap-2">
      <Button variant="text" color="from-theme" disabled={pending} onClick={() => onDecide('declined')}>
        {i18n('pages.app.notifications.decline')}
      </Button>
      <Button variant="filled" color="purple" disabled={pending} onClick={() => onDecide('accepted')}>
        {pending && <Icon icon="lucide:loader-circle" className="size-4 animate-spin" />}
        {i18n('pages.app.notifications.accept-pin')}
      </Button>
    </div>}
    {(notification.type === 'schedule_event_reminder' || isFlowEmail || status === 'accepted') && pageId && <div className="mt-2 flex justify-end">
      <Button variant="text" color="from-theme" onClick={() => onOpenPage(pageId, pageTitle)}>
        {i18n('pages.app.notifications.open-page')}
      </Button>
    </div>}
  </article>
}

export function NotificationCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { workspaceId } = useWorkspace()
  const { locale, slug } = useLanguage()
  const navigate = useNavigate()
  const notifications = useNotifications(workspaceId)

  const openPage = (pageId: string, title: string) => {
    void navigate({
      to: '/$lang/page/$pageId',
      params: { lang: slug, pageId },
      search: {},
      state: createPageNavigationState(pageId, title),
    })
    onOpenChange(false)
  }

  return <Modal open={open} onOpenChange={onOpenChange} size="sm" accessibleTitle={i18n('pages.app.notifications.title')}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{i18n('pages.app.notifications.title')}</h2>
        <p className={cn('mt-1 text-xs', THEME.textMuted)}>{i18n('pages.app.notifications.description')}</p>
      </div>
      {notifications.unreadCount > 0 && <span className="rounded-full bg-p-purple/10 px-2 py-1 text-xs font-semibold text-p-purple">
        {notifications.unreadCount}
      </span>}
    </div>
    <div className="grid gap-2">
      {notifications.isPending && <div className="flex min-h-28 items-center justify-center"><Icon icon="lucide:loader-circle" className="size-5 animate-spin text-p-purple" /></div>}
      {notifications.isError && <p className={cn('rounded-lg border border-divider p-3 text-sm', THEME.textMuted)}>{i18n('pages.app.notifications.load-error')}</p>}
      {!notifications.isPending && !notifications.isError && notifications.notifications.length === 0 && <p className={cn('rounded-lg border border-dashed border-divider p-4 text-center text-sm', THEME.textMuted)}>{i18n('pages.app.notifications.empty')}</p>}
      {notifications.notifications.map((notification) => <NotificationCard
        key={notification.id}
        notification={notification}
        locale={locale}
        pending={notifications.pendingRequestId === notification.resourceId}
        onRead={() => { if (!notification.readAt) void notifications.markRead(notification.id) }}
        onDecide={(decision) => { void notifications.decide(notification.resourceId, decision) }}
        onOpenPage={openPage}
      />)}
    </div>
  </Modal>
}
