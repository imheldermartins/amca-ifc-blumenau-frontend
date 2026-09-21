import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  authService,
  type AuthUser,
  type ActivationResult,
  type SignInInput,
  type SignUpInput,
  type SignUpResult,
} from '@/services/AuthService'
import { clientSessionStorage } from '@/lib/clientStorage'
import { sessionStore } from '@/services/sessionStore'
import { socketService } from '@/services/SocketService'

/**
 * Canal entre abas da MESMA origem. O logout numa aba avisa as outras — sem
 * isto, uma segunda aba seguiria com o socket vivo e o access token em memória
 * até ele expirar sozinho. É `BroadcastChannel` e não o evento `storage`
 * porque a sessão NÃO mora no `localStorage` (não há o que o `storage` event
 * observe).
 */
const SESSION_CHANNEL = 'cubs-session'
type SessionMessage = 'logout'

export interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  /** O primeiro `restore()` (checagem da sessão no boot) ainda não respondeu. */
  restoring: boolean
  /**
   * Aguarda a restauração inicial uma única vez e devolve a sessão atual.
   * Os guards do TanStack usam esta função sem repetir o refresh a cada rota.
   */
  ensureSession: () => Promise<AuthUser | null>
  signIn: (input: SignInInput) => Promise<AuthUser>
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  completeVerification: (token: string, input: { name?: string; password: string }) => Promise<ActivationResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  // `restoring`: o primeiro `restore()` ainda não respondeu. Enquanto true, o
  // layout não decide nada (nem monta rota privada, nem redireciona) — evita o
  // flash de "deslogado" antes de a sessão do cookie ser confirmada.
  const [restoring, setRestoring] = useState(true)
  const userRef = useRef<AuthUser | null>(null)
  const restoringRef = useRef(true)
  const restorePromiseRef = useRef<Promise<AuthUser | null> | null>(null)
  const mountedRef = useRef(true)
  const channelRef = useRef<BroadcastChannel | null>(null)

  const setAuthenticatedUser = useCallback((nextUser: AuthUser | null) => {
    userRef.current = nextUser
    if (mountedRef.current) setUser(nextUser)
  }, [])

  // O provider e os guards compartilham a mesma promise. Assim, o primeiro
  // beforeLoad pode aguardar o cookie HttpOnly sem montar a rota filha e sem
  // transformar cada navegação em um novo refresh.
  const ensureSession = useCallback((): Promise<AuthUser | null> => {
    if (!restoringRef.current) return Promise.resolve(userRef.current)

    restorePromiseRef.current ??= authService
      .restore()
      .catch(() => null)
      .then((restored) => {
        setAuthenticatedUser(restored)
        return restored
      })
      .finally(() => {
        restoringRef.current = false
        if (mountedRef.current) setRestoring(false)
      })

    return restorePromiseRef.current
  }, [setAuthenticatedUser])

  useEffect(() => {
    mountedRef.current = true
    void ensureSession()
    return () => {
      mountedRef.current = false
    }
  }, [ensureSession])

  // Um canal por provider: publica no logout e escuta o logout das outras abas.
  useEffect(() => {
    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(SESSION_CHANNEL)
      channelRef.current = channel
      channel.onmessage = (event: MessageEvent<SessionMessage>) => {
        if (event.data !== 'logout') return
        // Outra aba deslogou. O cookie de refresh já sumiu (é compartilhado),
        // mas ESTA aba ainda tem o access em memória e o socket vivo — limpa
        // os dois e recarrega, o que joga o guard de rota no sign-in.
        clientSessionStorage.clear()
        sessionStore.clear()
        socketService.disconnect()
        window.location.reload()
      }
    } catch {
      // BroadcastChannel indisponível: multi-aba não sincroniza, mas o logout
      // da própria aba continua funcionando.
    }
    return () => {
      channel?.close()
      channelRef.current = null
    }
  }, [])

  const signIn = useCallback(async (input: SignInInput) => {
    const authenticated = await authService.signIn(input)
    setAuthenticatedUser(authenticated)
    return authenticated
  }, [setAuthenticatedUser])

  const signUp = useCallback(async (input: SignUpInput) => {
    return authService.signUp(input)
  }, [])

  const completeVerification = useCallback(async (token: string, input: { name?: string; password: string }) => {
    const result = await authService.completeVerification(token, input)
    setAuthenticatedUser(result.user)
    return result
  }, [setAuthenticatedUser])

  const signOut = useCallback(async () => {
    // Limpa a UI ANTES da ida ao servidor: deslogar não pode ficar refém da
    // rede. O `signOut` do service nunca lança, e revoga do lado de lá.
    clientSessionStorage.clear()
    setAuthenticatedUser(null)
    // Derruba o socket JÁ (não espera a navegação desmontar os consumidores) e
    // avisa as outras abas para caírem juntas.
    socketService.disconnect()
    channelRef.current?.postMessage('logout' satisfies SessionMessage)
    await authService.signOut()
  }, [setAuthenticatedUser])

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAuthenticated: user !== null,
      restoring,
      ensureSession,
      signIn,
      signUp,
      completeVerification,
      signOut,
    }),
    [user, restoring, ensureSession, signIn, signUp, completeVerification, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.')
  }
  return context
}
