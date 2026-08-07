import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { TextField, NestedMenu, cn, type MenuNode } from 'cubs-components'

import type {
  ColumnConfigPatch,
  ColumnDataType,
  ColumnMask,
  ColumnOption,
  HeaderCol,
} from '../types'
import { TYPE_ICON } from './columnTypeIcons'
import { ColumnOptionsEditor, type ColumnOptionsEditorLabels } from './ColumnOptionsEditor'
import { useExternalDraft } from './cells/useExternalDraft'

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

export interface ColumnHeaderMenuProps {
  column: HeaderCol
  /** Tipo RESOLVIDO da coluna (o mesmo do ícone do header). */
  columnType: ColumnDataType
  onClose: () => void
  /** Cada callback presente habilita a seção correspondente. */
  onRename?: (name: string) => void
  onColumnTypeChange?: (type: ColumnDataType) => void
  onColumnOptionsChange?: (options: ColumnOption[]) => void
  onColumnConfigChange?: (patch: ColumnConfigPatch) => void
  /** A coluna tem células divergentes do tipo atual → habilita o "reset". */
  diverging?: boolean
  /** Executa o "reset de tipos" (destrutivo). Aparece só com `diverging`. */
  onColumnReset?: () => void
  labels?: ColumnHeaderMenuLabels
  /** Posicionamento fica com o caller (painel é `absolute`; pai `relative`). */
  className?: string
  style?: CSSProperties
}

/** Campo de renomear — rascunho realtime-safe (o menu pode estar aberto quando
    outra pessoa renomeia). Commit no blur, só se mudou. */
function RenameField({
  column,
  label,
  onRename,
  onClose,
}: {
  column: HeaderCol
  label: string
  onRename: (name: string) => void
  onClose: () => void
}) {
  const field = useExternalDraft(column.title)

  const commit = () => {
    if (!field.settle()) return
    const next = field.draft.trim()
    if (next === '' || next === column.title) return
    onRename(next)
    onClose()
  }

  return (
    <TextField
      aria-label={label}
      surface="background"
      size="sm"
      value={field.draft}
      onFocus={field.focus}
      onChange={(event) => field.change(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') {
          event.stopPropagation()
          field.revert()
          event.currentTarget.blur()
        }
      }}
    />
  )
}

/**
 * Menu da coluna (botão DIREITO no header). Monta um `NestedMenu` com as seções
 * habilitadas pela presença dos callbacks: renomear (campo inline), trocar
 * TIPO, e a config do tipo ATUAL — options (select), formato/moeda (numeric),
 * máscara (text). Cada write sobe pelo callback; a lib não conhece transporte.
 *
 * O painel é `absolute` (posicionado pelo caller); os SUBMENUS são Popovers do
 * `NestedMenu` (portalados). Por isso o fechar-ao-clicar-fora IGNORA cliques
 * dentro de qualquer popper do Radix — senão clicar num submenu fecharia tudo.
 */
export function ColumnHeaderMenu({
  column,
  columnType,
  onClose,
  onRename,
  onColumnTypeChange,
  onColumnOptionsChange,
  onColumnConfigChange,
  diverging,
  onColumnReset,
  labels,
  className,
  style,
}: ColumnHeaderMenuProps) {
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      // Clique dentro de um submenu (Popover portalado do NestedMenu) não fecha.
      if ((event.target as Element)?.closest?.('[data-radix-popper-content-wrapper]')) return
      onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const check = (active: boolean) => (active ? 'lucide:check' : undefined)
  const nodes: MenuNode[] = []

  // Renomear.
  if (onRename) {
    nodes.push({
      name: labels?.renameColumn ?? 'Renomear',
      content: (
        <RenameField
          column={column}
          label={labels?.renameColumn ?? 'Renomear coluna'}
          onRename={onRename}
          onClose={onClose}
        />
      ),
    })
  }

  // Trocar tipo.
  if (onColumnTypeChange) {
    nodes.push({
      name: labels?.changeType ?? 'Tipo',
      icon: TYPE_ICON[columnType],
      children: COLUMN_TYPES.map((type) => ({
        name: labels?.columnTypes?.[type] ?? type,
        icon: check(type === columnType) ?? TYPE_ICON[type],
        onSelect: () => {
          onColumnTypeChange(type)
          onClose()
        },
      })),
    })
  }

  // Options (select).
  if (columnType === 'select' && onColumnOptionsChange) {
    nodes.push({
      name: labels?.optionsMenu ?? 'Opções',
      icon: 'lucide:list',
      children: [
        {
          name: '',
          content: (
            <ColumnOptionsEditor
              options={column.options ?? []}
              onChange={onColumnOptionsChange}
              labels={labels}
            />
          ),
        },
      ],
    })
  }

  // Formato + moeda (numeric).
  if (columnType === 'numeric' && onColumnConfigChange) {
    nodes.push({
      name: labels?.formatMenu ?? 'Formato',
      icon: 'lucide:percent',
      children: [
        {
          name: labels?.formatPercentage ?? 'Percentual',
          icon: check(column.format === 'percentage'),
          onSelect: () => onColumnConfigChange({ format: 'percentage', currency: null }),
        },
        {
          name: labels?.formatCurrency ?? 'Moeda',
          icon: check(column.format === 'currency'),
          children: [
            {
              name: labels?.currencyBRL ?? 'Real (BRL)',
              icon: check(column.currency === 'BRL'),
              onSelect: () => onColumnConfigChange({ format: 'currency', currency: 'BRL' }),
            },
          ],
        },
        {
          name: labels?.none ?? 'Nenhum',
          onSelect: () => onColumnConfigChange({ format: null, currency: null }),
        },
      ],
    })
  }

  // Máscara (text).
  if (columnType === 'text' && onColumnConfigChange) {
    nodes.push({
      name: labels?.maskMenu ?? 'Máscara',
      icon: 'lucide:asterisk',
      children: [
        {
          name: labels?.none ?? 'Nenhuma',
          icon: check(!column.mask),
          onSelect: () => onColumnConfigChange({ mask: null }),
        },
        ...TEXT_MASKS.map((mask) => ({
          name: labels?.masks?.[mask] ?? mask,
          icon: check(column.mask === mask),
          onSelect: () => onColumnConfigChange({ mask }),
        })),
      ],
    })
  }

  // Reset de tipos — só com divergência (há valor que não casa com o tipo).
  // Destrutivo, então é o único item de perigo e fica por último.
  if (diverging && onColumnReset) {
    nodes.push({
      name: labels?.resetType ?? 'Resetar tipo',
      icon: 'lucide:alert-triangle',
      danger: true,
      onSelect: () => {
        onColumnReset()
        onClose()
      },
    })
  }

  return (
    <div
      role="menu"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        'absolute z-50 mt-1 min-w-48 rounded-lg border border-divider-contrast p-1 shadow-xl',
        'bg-glass backdrop-blur-md',
        className,
      )}
    >
      <NestedMenu nodes={nodes} />
    </div>
  )
}
