import type { ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Icon } from '@iconify/react'
import { Button, cn } from 'cubs-components'

import { i18n } from '@/lib/i18n'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

/**
 * Largura por tamanho — escala NATIVA do Tailwind (`max-w-sm|md|lg` = 24/28/32
 * rem). Escritas por extenso porque o Tailwind só gera a classe que enxerga
 * literal no código (nada de `max-w-${size}` montado em runtime).
 */
const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
}

export interface ModalProps {
  /** Aberta? Controlada de fora — use `useDialog()` para não escrever isso na mão. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Largura máxima. Padrão: `md`. */
  size?: ModalSize
  /**
   * Título APENAS para leitor de tela (`sr-only`). A modal não desenha título:
   * o header só tem o botão de fechar, e o conteúdo visual inteiro é problema
   * do `children`. Mesmo assim o Radix exige um `Dialog.Title` para anunciar o
   * diálogo — sem ele, o leitor de tela abre uma caixa anônima (e o Radix
   * reclama no console). Sempre via `i18n()`.
   */
  accessibleTitle: string
  /** Classes do corpo (a área rolável), não do container. */
  className?: string
  children: ReactNode
}

/**
 * Modal do Cub's — Radix Dialog (padrão shadcn: a primitiva dá comportamento,
 * o estilo é nosso e mora aqui) com os tokens do tema.
 *
 * Vem de fábrica: backdrop com blur, foco preso dentro, ESC/clique fora
 * fechando, scroll do body travado e o botão de fechar FIXO no header — o
 * corpo rola por baixo dele quando o conteúdo passa da altura da tela.
 *
 * O conteúdo é livre (`children: ReactNode`): esta casca não impõe título,
 * rodapé nem botões. Quem abre monta a interface que quiser dentro.
 *
 * @example
 * const dialog = useDialog()
 * <Button onClick={dialog.openDialog}>Abrir</Button>
 * <Modal {...dialog.dialogProps} size="lg" accessibleTitle={i18n('...')}>
 *   <MinhaInterface />
 * </Modal>
 */
export function Modal({
  open,
  onOpenChange,
  size = 'md',
  accessibleTitle,
  className,
  children,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Scrim: dark-900 cru de propósito — não existe token de backdrop no tema
            (mesma exceção do THEME.textMuted), e ele precisa escurecer nos DOIS
            temas, então não acompanha background/contrast. */}
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-dark-900/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />

        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[calc(100%-2rem)]',
            SIZES[size],
            'rounded-2xl bg-background border border-divider shadow-dark-900 shadow-2xl',
            'flex max-h-[calc(100dvh-4rem)] flex-col',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <Dialog.Title className="sr-only">{accessibleTitle}</Dialog.Title>

          <header className="flex shrink-0 items-center justify-end px-2 py-1">
            <Dialog.Close asChild>
              <Button
                variant="text"
                color="red"
                className="px-1.5 py-1"
                aria-label={i18n('common.fechar')}
              >
                <Icon icon="lucide:x" fontSize={18} />
              </Button>
            </Dialog.Close>
          </header>

          <div className={cn('min-h-0 flex-1 overflow-auto p-3.5', className)}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
