import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Icon } from '@iconify/react'
import { Button, cn } from 'cubs-components'
import type { CalendarPinInput } from 'cubs-database'

import { Modal } from '@/components/Modal'
import { useFeedback } from '@/contexts/FeedbackContext'
import { i18n } from '@/lib/i18n'
import { THEME } from '@/lib/theme'
import { scheduleService } from '@/services/ScheduleService'

export interface SchedulePinRequestTarget extends CalendarPinInput {
  title: string
}

export function SchedulePinRequestDialog({
  open,
  onOpenChange,
  workspaceId,
  target,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string | null
  target: SchedulePinRequestTarget | null
}) {
  const feedback = useFeedback()
  const [search, setSearch] = useState('')
  const [recipientId, setRecipientId] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setSearch('')
    setRecipientId(null)
  }, [open, target?.pageId])

  const recipients = useQuery({
    queryKey: ['schedule-pin-recipients', workspaceId ?? 'none', target?.pageId ?? 'none'],
    queryFn: () => scheduleService.recipients(workspaceId!, target!.pageId),
    enabled: Boolean(open && workspaceId && target),
  })
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase()
    if (!needle) return recipients.data ?? []
    return (recipients.data ?? []).filter((recipient) =>
      `${recipient.name ?? ''} ${recipient.email}`.toLocaleLowerCase().includes(needle),
    )
  }, [recipients.data, search])

  const request = useMutation({
    mutationFn: () => scheduleService.requestPin(workspaceId!, target!.pageId, {
      recipientUserId: recipientId!,
      dateColumnId: target!.dateColumnId,
      colorColumnId: target!.colorColumnId,
    }),
    onSuccess: (saved) => {
      feedback({
        title: i18n('pages.app.schedule.requestPinSuccessTitle'),
        description: i18n('pages.app.schedule.requestPinSuccessDescription', {
          recipient: saved.recipient.name || saved.recipient.email,
        }),
        variant: 'success',
      })
      onOpenChange(false)
    },
    onError: () => feedback({
      title: i18n('pages.app.schedule.requestPinErrorTitle'),
      description: i18n('pages.app.schedule.requestPinErrorDescription'),
      variant: 'error',
    }),
  })

  return <Modal open={open} onOpenChange={onOpenChange} size="sm" accessibleTitle={i18n('pages.app.schedule.requestPinTitle')}>
    <h2 className="text-lg font-semibold">{i18n('pages.app.schedule.requestPinTitle')}</h2>
    <p className={cn('mt-1 text-sm', THEME.textMuted)}>
      {i18n('pages.app.schedule.requestPinDescription', { title: target?.title ?? '' })}
    </p>
    <label className="mt-4 block">
      <span className="sr-only">{i18n('pages.app.schedule.searchRecipients')}</span>
      <span className="flex items-center gap-2 rounded-lg border border-divider bg-background px-3 focus-within:border-p-purple/50 focus-within:ring-2 focus-within:ring-p-purple/15">
        <Icon icon="lucide:search" className={cn('size-4', THEME.textMuted)} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={i18n('pages.app.schedule.searchRecipients')}
          className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
        />
      </span>
    </label>
    <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
      {recipients.isPending && <div className="flex min-h-24 items-center justify-center"><Icon icon="lucide:loader-circle" className="size-5 animate-spin text-p-purple" /></div>}
      {recipients.isError && <p className={cn('p-3 text-sm', THEME.textMuted)}>{i18n('pages.app.schedule.recipientsError')}</p>}
      {!recipients.isPending && !recipients.isError && !filtered.length && <p className={cn('p-3 text-sm', THEME.textMuted)}>{i18n('pages.app.schedule.noRecipients')}</p>}
      {filtered.map((recipient) => <button
        key={recipient.id}
        type="button"
        aria-pressed={recipientId === recipient.id}
        onClick={() => setRecipientId(recipient.id)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-p-purple',
          recipientId === recipient.id ? 'border-p-purple/40 bg-p-purple/10' : 'border-divider hover:bg-active',
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-active text-xs font-semibold">
          {(recipient.name || recipient.email).slice(0, 1).toLocaleUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{recipient.name || recipient.email}</span>
          {recipient.name && <span className={cn('block truncate text-xs', THEME.textMuted)}>{recipient.email}</span>}
        </span>
        {recipientId === recipient.id && <Icon icon="lucide:check" className="size-4 text-p-purple" />}
      </button>)}
    </div>
    <div className="mt-4 flex justify-end gap-2">
      <Button variant="text" color="from-theme" onClick={() => onOpenChange(false)}>{i18n('pages.app.schedule.cancel')}</Button>
      <Button variant="filled" color="purple" disabled={!recipientId || request.isPending} onClick={() => request.mutate()}>
        {request.isPending ? <Icon icon="lucide:loader-circle" className="size-4 animate-spin" /> : <Icon icon="solar:pin-bold" className="size-4" />}
        {i18n('pages.app.schedule.requestPinAction')}
      </Button>
    </div>
  </Modal>
}
