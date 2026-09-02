import { Button } from 'cubs-components'

import { Modal } from '@components/Modal'
import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

export interface ReplaceViewFiltersModalProps {
  open: boolean
  onReplace: () => void
  onKeepSaved: () => void
}

/**
 * Confirma se o estado soberano da URL também deve substituir o snapshot.
 * Fechar, Escape e backdrop equivalem à escolha segura “Não”.
 */
export function ReplaceViewFiltersModal({
  open,
  onReplace,
  onKeepSaved,
}: ReplaceViewFiltersModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeepSaved()
      }}
      size="sm"
      accessibleTitle={i18n('pages.app.cubs-database.url-filters.title')}
      className="px-5 pb-5 pt-1"
    >
      <Typography variant="body" as="p" className="text-base">
        {i18n('pages.app.cubs-database.url-filters.question')}
      </Typography>
      <Typography variant="body" as="p" className="mt-2 text-sm opacity-70">
        {i18n('pages.app.cubs-database.url-filters.description')}
      </Typography>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="text" color="from-theme" onClick={onReplace}>
          {i18n('pages.app.cubs-database.url-filters.yes')}
        </Button>
        <Button variant="filled" color="purple" autoFocus onClick={onKeepSaved}>
          {i18n('pages.app.cubs-database.url-filters.no')}
        </Button>
      </div>
    </Modal>
  )
}
