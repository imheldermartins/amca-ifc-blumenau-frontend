import { createContext, useContext } from 'react'
import type { MentionOption, MentionScope } from '@/shared/mentions'

export type MentionContextValue = {
  mentions: Record<string, Record<string, string>>
  addMentionsGroup: (groupName: string, mentions: Record<string, string>) => void
  options: MentionOption[]
  values: Record<string, string | null>
  scope: MentionScope
  loading: boolean
  resolve: (text: string) => string
  register: (ids: string[]) => void
}

const MentionContextValue = createContext<MentionContextValue | undefined>(undefined)

export const MentionProvider = MentionContextValue.Provider
export function useOptionalMention() { return useContext(MentionContextValue) }

export function useMention() {
  const context = useContext(MentionContextValue)
  if (!context) {
    throw new Error('useMention precisa ser usado dentro de <MentionContext>.')
  }
  return context
}
