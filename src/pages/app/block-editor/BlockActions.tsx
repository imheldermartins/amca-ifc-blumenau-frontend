import type { Editor } from '@tiptap/core'
import { Icon } from '@iconify/react'
import { Button, cn } from 'cubs-components'

import { Typography } from '@components/Typography'
import { i18n } from '@/lib/i18n'

import type { EditorBlockActionProps, EditorBlockKind } from './types'

interface BlockActionConfig {
  kind: EditorBlockKind
  icon: string
  labelKey: string
  activate: (editor: Editor) => void
}

function updateCurrentBlockKind(editor: Editor, kind: EditorBlockKind): boolean {
  const { tr } = editor.state
  const { $from } = tr.selection

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (node.type.name !== 'editableBlock') continue

    tr.setNodeMarkup($from.before(depth), undefined, { ...node.attrs, kind })
    editor.view.dispatch(tr)
    return true
  }

  return false
}

function activateRichText(editor: Editor) {
  editor.chain().focus().setParagraph().run()
  updateCurrentBlockKind(editor, 'richText')
}

function activateBulletList(editor: Editor) {
  if (!editor.isActive('bulletList')) editor.chain().focus().toggleBulletList().run()
  updateCurrentBlockKind(editor, 'bulletList')
}

function activateEnumerateList(editor: Editor) {
  if (!editor.isActive('orderedList')) editor.chain().focus().toggleOrderedList().run()
  updateCurrentBlockKind(editor, 'enumerateList')
}

function activateCheckList(editor: Editor) {
  if (!editor.isActive('taskList')) editor.chain().focus().toggleTaskList().run()
  updateCurrentBlockKind(editor, 'checkList')
}

function BlockAction({
  editor,
  compact,
  onSelect,
  config,
}: EditorBlockActionProps & { config: BlockActionConfig }) {
  const handleSelect = () => {
    if (onSelect) onSelect()
    else config.activate(editor)
  }

  return (
    <Button
      variant="text"
      color="from-theme"
      className={cn('justify-start px-2 py-1.5', compact && 'size-9 justify-center p-0')}
      aria-label={i18n(config.labelKey)}
      onMouseDown={(event) => event.preventDefault()}
      onClick={handleSelect}
    >
      <Icon icon={config.icon} fontSize={17} />
      {!compact && (
        <Typography variant="body" as="span">
          {i18n(config.labelKey)}
        </Typography>
      )}
    </Button>
  )
}

const RICH_TEXT: BlockActionConfig = {
  kind: 'richText',
  icon: 'lucide:text-cursor-input',
  labelKey: 'pages.block-editor.blocks.rich-text',
  activate: activateRichText,
}

const BULLET_LIST: BlockActionConfig = {
  kind: 'bulletList',
  icon: 'lucide:list',
  labelKey: 'pages.block-editor.blocks.bullet-list',
  activate: activateBulletList,
}

const ENUMERATE_LIST: BlockActionConfig = {
  kind: 'enumerateList',
  icon: 'lucide:list-ordered',
  labelKey: 'pages.block-editor.blocks.enumerate-list',
  activate: activateEnumerateList,
}

const CHECK_LIST: BlockActionConfig = {
  kind: 'checkList',
  icon: 'lucide:list-checks',
  labelKey: 'pages.block-editor.blocks.check-list',
  activate: activateCheckList,
}

export function RichText(props: EditorBlockActionProps) {
  return <BlockAction {...props} config={RICH_TEXT} />
}

export function BulletLists(props: EditorBlockActionProps) {
  return <BlockAction {...props} config={BULLET_LIST} />
}

export function EnumerateList(props: EditorBlockActionProps) {
  return <BlockAction {...props} config={ENUMERATE_LIST} />
}

export function CheckList(props: EditorBlockActionProps) {
  return <BlockAction {...props} config={CHECK_LIST} />
}
