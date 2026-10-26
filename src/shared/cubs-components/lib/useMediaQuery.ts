import { useCallback, useSyncExternalStore } from 'react'

/** Tracks viewport and input capabilities, including changes after mounting. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((changed: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
    const media = window.matchMedia(query)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [query])
  const snapshot = useCallback(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches, [query])
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
