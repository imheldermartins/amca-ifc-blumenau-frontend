import { Button } from 'cubs-components'

import { Modal } from '@components/Modal'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export interface SignOutConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

/** Confirmação curta que protege o encerramento da sessão. */
export function SignOutConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
}: SignOutConfirmationModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      accessibleTitle={i18n('pages.app.sign-out.title')}
      className="px-5 pb-5 pt-1"
    >
      <Typography variant="body" as="p" className="text-base">
        {i18n('pages.app.sign-out.question')}
      </Typography>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="text" color="from-theme" onClick={() => void onConfirm()}>
          {i18n('pages.app.sign-out.yes')}
        </Button>
        <Button variant="filled" color="red" autoFocus onClick={() => onOpenChange(false)}>
          {i18n('pages.app.sign-out.no')}
        </Button>
      </div>
    </Modal>
  )
}
