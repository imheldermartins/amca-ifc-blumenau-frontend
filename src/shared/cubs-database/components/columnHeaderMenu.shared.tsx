import type { ReactNode } from 'react'
import type { MenuNode } from 'cubs-components'

import type {
  ColumnConfigPatch,
  ColumnDataType,
  ColumnMask,
  ColumnOption,
  HeaderCol,
} from '../types'
import { ColumnOptionsEditor, type ColumnOptionsEditorLabels } from './ColumnOptionsEditor'
import { TYPE_ICON } from './columnTypeIcons'

const COLUMN_TYPES: ColumnDataType[] = ['text', 'numeric', 'select', 'date', 'checkbox']
const TEXT_MASKS: ColumnMask[] = ['cpf', 'cep', 'phone-br', 'date']

export interface ColumnHeaderMenuLabels extends ColumnOptionsEditorLabels {
  /** Rótulo do campo de renomear (aria-label; sem label visível). */
  renameColumn?: string
  /** Rótulos exibíveis por tipo de coluna; ausente = o token cru. */
  columnTypes?: Partial<Record<ColumnDataType, string>>
  /** Submenus. */
  changeType?: string
  optionsMenu?: string
  formatMenu?: string
  maskMenu?: string
  /** Numeric. */
  formatPercentage?: string
  formatCurrency?: string
  currencyBRL?: string
  /** "nenhum" (limpar format/máscara). */
  none?: string
  /** Máscaras exibíveis; ausente = o token cru. */
  masks?: Partial<Record<ColumnMask, string>>
  /** Item destrutivo de "reset de tipos" (só aparece com divergência). */
  resetType?: string
}

export interface ColumnHeaderMenuContext {
  column: HeaderCol
  columnType: ColumnDataType
  onClose: () => void
  onRename?: (name: string) => void
  renderRenameContent: (onRename: (name: string) => void) => ReactNode
  onColumnTypeChange?: (type: ColumnDataType) => void
  onColumnOptionsChange?: (options: ColumnOption[]) => void
  onColumnConfigChange?: (patch: ColumnConfigPatch) => void
  diverging?: boolean
  onColumnReset?: () => void
  labels?: ColumnHeaderMenuLabels
}

/**
 * Elo da cadeia que constrói o menu. Cada tratador pode contribuir com um nó
 * e sempre entrega o contexto ao próximo, mantendo ordem e regras de inclusão
 * fora do componente React.
 */
abstract class ColumnMenuNodeHandler {
  private next?: ColumnMenuNodeHandler

  setNext(next: ColumnMenuNodeHandler): ColumnMenuNodeHandler {
    this.next = next
    return next
  }

  handle(context: ColumnHeaderMenuContext): MenuNode[] {
    const node = this.createNode(context)
    const remainingNodes = this.next?.handle(context) ?? []
    return node ? [node, ...remainingNodes] : remainingNodes
  }

  protected abstract createNode(context: ColumnHeaderMenuContext): MenuNode | undefined
}

class RenameNodeHandler extends ColumnMenuNodeHandler {
  protected createNode(context: ColumnHeaderMenuContext): MenuNode | undefined {
    if (!context.onRename) return undefined

    return {
      id: 'rename',
      name: context.labels?.renameColumn ?? 'Renomear',
      content: context.renderRenameContent(context.onRename),
    }
  }
}

class ChangeTypeNodeHandler extends ColumnMenuNodeHandler {
  protected createNode(context: ColumnHeaderMenuContext): MenuNode | undefined {
    if (!context.onColumnTypeChange) return undefined

    return {
      id: 'change-type',
      name: context.labels?.changeType ?? 'Tipo',
      icon: TYPE_ICON[context.columnType],
      children: COLUMN_TYPES.map((type) => ({
        id: `change-type-${type}`,
        name: context.labels?.columnTypes?.[type] ?? type,
        icon: type === context.columnType ? 'lucide:check' : TYPE_ICON[type],
        onSelect: () => {
          context.onColumnTypeChange?.(type)
          context.onClose()
        },
      })),
    }
  }
}

class SelectOptionsNodeHandler extends ColumnMenuNodeHandler {
  protected createNode(context: ColumnHeaderMenuContext): MenuNode | undefined {
    if (context.columnType !== 'select' || !context.onColumnOptionsChange) return undefined

    return {
      id: 'select-options',
      name: context.labels?.optionsMenu ?? 'Opções',
      icon: 'lucide:list',
      children: [
        {
          id: 'select-options-editor',
          name: '',
          content: (
            <ColumnOptionsEditor
              options={context.column.options ?? []}
              onChange={context.onColumnOptionsChange}
              labels={context.labels}
            />
          ),
        },
      ],
    }
  }
}

class NumericFormatNodeHandler extends ColumnMenuNodeHandler {
  protected createNode(context: ColumnHeaderMenuContext): MenuNode | undefined {
    if (context.columnType !== 'numeric' || !context.onColumnConfigChange) return undefined

    const check = (active: boolean) => (active ? 'lucide:check' : undefined)

    return {
      id: 'numeric-format',
      name: context.labels?.formatMenu ?? 'Formato',
      icon: 'lucide:percent',
      children: [
        {
          id: 'numeric-format-percentage',
          name: context.labels?.formatPercentage ?? 'Percentual',
          icon: check(context.column.format === 'percentage'),
          onSelect: () =>
            context.onColumnConfigChange?.({ format: 'percentage', currency: null }),
        },
        {
          id: 'numeric-format-currency',
          name: context.labels?.formatCurrency ?? 'Moeda',
          icon: check(context.column.format === 'currency'),
          children: [
            {
              id: 'numeric-format-currency-brl',
              name: context.labels?.currencyBRL ?? 'Real (BRL)',
              icon: check(context.column.currency === 'BRL'),
              onSelect: () =>
                context.onColumnConfigChange?.({ format: 'currency', currency: 'BRL' }),
            },
          ],
        },
        {
          id: 'numeric-format-none',
          name: context.labels?.none ?? 'Nenhum',
          onSelect: () => context.onColumnConfigChange?.({ format: null, currency: null }),
        },
      ],
    }
  }
}

class TextMaskNodeHandler extends ColumnMenuNodeHandler {
  protected createNode(context: ColumnHeaderMenuContext): MenuNode | undefined {
    if (context.columnType !== 'text' || !context.onColumnConfigChange) return undefined

    const check = (active: boolean) => (active ? 'lucide:check' : undefined)

    return {
      id: 'text-mask',
      name: context.labels?.maskMenu ?? 'Máscara',
      icon: 'lucide:asterisk',
      children: [
        {
          id: 'text-mask-none',
          name: context.labels?.none ?? 'Nenhuma',
          icon: check(!context.column.mask),
          onSelect: () => context.onColumnConfigChange?.({ mask: null }),
        },
        ...TEXT_MASKS.map((mask) => ({
          id: `text-mask-${mask}`,
          name: context.labels?.masks?.[mask] ?? mask,
          icon: check(context.column.mask === mask),
          onSelect: () => context.onColumnConfigChange?.({ mask }),
        })),
      ],
    }
  }
}

class ResetTypeNodeHandler extends ColumnMenuNodeHandler {
  protected createNode(context: ColumnHeaderMenuContext): MenuNode | undefined {
    if (!context.diverging || !context.onColumnReset) return undefined

    return {
      id: 'reset-type',
      name: context.labels?.resetType ?? 'Resetar tipo',
      icon: 'lucide:alert-triangle',
      danger: true,
      onSelect: () => {
        context.onColumnReset?.()
        context.onClose()
      },
    }
  }
}

function createColumnMenuChain(): ColumnMenuNodeHandler {
  const first = new RenameNodeHandler()
  first
    .setNext(new ChangeTypeNodeHandler())
    .setNext(new SelectOptionsNodeHandler())
    .setNext(new NumericFormatNodeHandler())
    .setNext(new TextMaskNodeHandler())
    .setNext(new ResetTypeNodeHandler())
  return first
}

const COLUMN_MENU_CHAIN = createColumnMenuChain()

export function buildColumnHeaderMenuNodes(context: ColumnHeaderMenuContext): MenuNode[] {
  return COLUMN_MENU_CHAIN.handle(context)
}
