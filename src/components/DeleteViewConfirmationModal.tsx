import { useState } from 'react'
import { Button } from 'cubs-components'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export interface DeleteViewConfirmationContentProps {
  viewName: string
  onClose: () => void
  onConfirm: () => boolean | void | Promise<boolean | void>
}

/** Confirma a remoção permanente de uma visualização identificando-a pelo nome. */
export function DeleteViewConfirmationContent({
  viewName,
  onClose,
  onConfirm,
}: DeleteViewConfirmationContentProps) {
  const [pending, setPending] = useState(false)
  const confirm = async () => {
    if (pending) return
    setPending(true)
    try {
      if (await onConfirm() !== false) onClose()
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <Typography variant="body" as="p" className="text-base">
        {i18n('pages.app.cubs-database.delete-view.question', { viewName })}
      </Typography>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="text" color="red" disabled={pending} onClick={() => void confirm()}>
          {i18n('pages.app.cubs-database.delete-view.confirm')}
        </Button>
        <Button variant="filled" color="purple" disabled={pending} autoFocus onClick={onClose}>
          {i18n('pages.app.cubs-database.delete-view.cancel')}
        </Button>
      </div>
    </>
  )
}
