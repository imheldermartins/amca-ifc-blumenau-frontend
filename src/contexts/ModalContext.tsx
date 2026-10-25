import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { Modal, type ModalSize } from '@/components/Modal'

export interface ModalControls {
  closeModal: () => void
  updateModal: (patch: ModalUpdate) => void
  setModalContent: (content: ModalContent) => void
}

export type ModalContent = ReactNode | ((controls: ModalControls) => ReactNode)

export interface OpenModalOptions {
  content: ModalContent
  size?: ModalSize
  className?: string
  /** Escape, backdrop e X podem fechar. Ações internas ainda podem chamar `closeModal`. */
  dismissible?: boolean
  onClose?: () => void
}

export type ModalUpdate = Partial<Omit<OpenModalOptions, 'content' | 'onClose'>> & {
  content?: ModalContent
  onClose?: (() => void) | undefined
}

export interface ModalHandle extends ModalControls {
  id: string
}

export interface ModalApi {
  openModal: (options: OpenModalOptions) => ModalHandle
  closeModal: (id?: string) => void
  updateModal: (patch: ModalUpdate, id?: string) => void
  setModalContent: (content: ModalContent, id?: string) => void
}

interface ModalEntry extends OpenModalOptions {
  id: string
  ownerId: string
}

interface ModalContextValue {
  openOwnedModal: (ownerId: string, options: OpenModalOptions) => ModalHandle
  closeModal: ModalApi['closeModal']
  updateModal: ModalApi['updateModal']
  setModalContent: ModalApi['setModalContent']
  retainOwner: (ownerId: string) => void
  releaseOwner: (ownerId: string) => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function ModalProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0)
  const entriesRef = useRef<ModalEntry[]>([])
  const ownerCleanupTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const [entries, setEntries] = useState<ModalEntry[]>([])

  const replaceEntries = useCallback((next: ModalEntry[]) => {
    entriesRef.current = next
    setEntries(next)
  }, [])

  const closeModal = useCallback((id?: string) => {
    const current = entriesRef.current
    const target = id ? current.find((entry) => entry.id === id) : current.at(-1)
    if (!target) return
    replaceEntries(current.filter((entry) => entry.id !== target.id))
    target.onClose?.()
  }, [replaceEntries])

  const updateModal = useCallback((patch: ModalUpdate, id?: string) => {
    const current = entriesRef.current
    const targetId = id ?? current.at(-1)?.id
    if (!targetId) return
    replaceEntries(current.map((entry) => entry.id === targetId ? { ...entry, ...patch } : entry))
  }, [replaceEntries])

  const setModalContent = useCallback((content: ModalContent, id?: string) => {
    updateModal({ content }, id)
  }, [updateModal])

  const openOwnedModal = useCallback((ownerId: string, options: OpenModalOptions): ModalHandle => {
    const id = `modal-${++sequence.current}`
    replaceEntries([...entriesRef.current, {
      size: 'md',
      dismissible: true,
      ...options,
      id,
      ownerId,
    }])
    return {
      id,
      closeModal: () => closeModal(id),
      updateModal: (patch) => updateModal(patch, id),
      setModalContent: (content) => setModalContent(content, id),
    }
  }, [closeModal, replaceEntries, setModalContent, updateModal])

  const closeOwnedModals = useCallback((ownerId: string) => {
    const current = entriesRef.current
    const next = current.filter((entry) => entry.ownerId !== ownerId)
    if (next.length !== current.length) replaceEntries(next)
  }, [replaceEntries])

  // React StrictMode desmonta e remonta effects em desenvolvimento. Adiamos a
  // limpeza por um tick para distinguir esse replay de um unmount real; a nova
  // montagem cancela o timer e preserva modais abertas por deep-link.
  const retainOwner = useCallback((ownerId: string) => {
    const timer = ownerCleanupTimers.current.get(ownerId)
    if (timer === undefined) return
    clearTimeout(timer)
    ownerCleanupTimers.current.delete(ownerId)
  }, [])

  const releaseOwner = useCallback((ownerId: string) => {
    const current = ownerCleanupTimers.current.get(ownerId)
    if (current !== undefined) clearTimeout(current)
    const timer = setTimeout(() => {
      ownerCleanupTimers.current.delete(ownerId)
      closeOwnedModals(ownerId)
    }, 0)
    ownerCleanupTimers.current.set(ownerId, timer)
  }, [closeOwnedModals])

  useEffect(() => () => {
    for (const timer of ownerCleanupTimers.current.values()) clearTimeout(timer)
    ownerCleanupTimers.current.clear()
  }, [])

  const value = useMemo<ModalContextValue>(() => ({
    openOwnedModal,
    closeModal,
    updateModal,
    setModalContent,
    retainOwner,
    releaseOwner,
  }), [closeModal, openOwnedModal, releaseOwner, retainOwner, setModalContent, updateModal])

  return (
    <ModalContext.Provider value={value}>
      {children}
      {entries.map((entry) => {
        const controls: ModalControls = {
          closeModal: () => closeModal(entry.id),
          updateModal: (patch) => updateModal(patch, entry.id),
          setModalContent: (content) => setModalContent(content, entry.id),
        }
        const content = typeof entry.content === 'function' ? entry.content(controls) : entry.content
        return (
          <Modal
            key={entry.id}
            open
            onOpenChange={(open) => { if (!open && entry.dismissible !== false) closeModal(entry.id) }}
            size={entry.size}
            dismissible={entry.dismissible}
            className={entry.className}
          >
            {content}
          </Modal>
        )
      })}
    </ModalContext.Provider>
  )
}

export function useModalContext(): ModalApi {
  const context = ReactUseModalContext()
  const ownerId = useId()

  useEffect(() => {
    context.retainOwner(ownerId)
    return () => context.releaseOwner(ownerId)
  }, [context, ownerId])

  return useMemo(() => ({
    openModal: (options) => context.openOwnedModal(ownerId, options),
    closeModal: context.closeModal,
    updateModal: context.updateModal,
    setModalContent: context.setModalContent,
  }), [context, ownerId])
}

function ReactUseModalContext(): ModalContextValue {
  const context = useContext(ModalContext)
  if (!context) throw new Error('useModal precisa ser usado dentro de <ModalProvider>.')
  return context
}
