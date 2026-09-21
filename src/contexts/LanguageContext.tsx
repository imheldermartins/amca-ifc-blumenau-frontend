import { createContext, useContext, type ReactNode } from 'react'

import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n'

const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE)

export function LanguageProvider({
  language,
  children,
}: {
  language: Language
  children: ReactNode
}) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>
}

/** Idioma canônico já validado pelo layout `/$lang`. */
export function useLanguage(): Language {
  return useContext(LanguageContext)
}
