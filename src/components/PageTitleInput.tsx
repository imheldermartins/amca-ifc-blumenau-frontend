import {MentionTextField} from 'cubs-components'
import type {ComponentProps} from 'react'
import {i18n} from '@/lib/i18n'

/** Shared title presentation for the page shell and page drafts. */
export function PageTitleInput(props: ComponentProps<typeof MentionTextField>) {
  return <MentionTextField multiline aria-label={i18n('pages.app.pagina.title-label')}
    placeholder={i18n('pages.app.pagina.sem-titulo')}
    className="min-w-0 w-full [font:inherit]"
    inputClassName="block min-h-[1.2em] min-w-0 w-full break-words border-0 bg-transparent p-0 text-inherit shadow-none outline-none ring-0 [font:inherit] focus:border-0 focus:outline-none focus:ring-0"
    style={{font: 'inherit'}} {...props} />
}
