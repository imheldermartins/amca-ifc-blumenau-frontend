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
  type SignInInput,
  type SignUpInput,
} from '@/services/AuthService'
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
  signIn: (input: SignInInput) => Promise<AuthUser>
  signUp: (input: SignUpInput) => Promise<AuthUser>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  // `restoring`: o primeiro `restore()` ainda não respondeu. Enquanto true, o
  // layout não decide nada (nem monta rota privada, nem redireciona) — evita o
  // flash de "deslogado" antes de a sessão do cookie ser confirmada.
  const [restoring, setRestoring] = useState(true)
  const channelRef = useRef<BroadcastChannel | null>(null)

  // Confere a sessão UMA vez, no boot. É o "useEffect que confere se foi
  // logado" — não um refresh proativo em cada rota. Sem sessão, `user` fica
  // null e o layout manda para o sign-in; a tela de login NÃO redispara isto.
  useEffect(() => {
    let active = true
    authService
      .restore()
      .then((restored) => {
        if (active) setUser(restored)
      })
      .finally(() => {
        if (active) setRestoring(false)
      })
    return () => {
      active = false
    }
  }, [])

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
    setUser(authenticated)
    return authenticated
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const created = await authService.signUp(input)
    setUser(created)
    return created
  }, [])

  const signOut = useCallback(async () => {
    // Limpa a UI ANTES da ida ao servidor: deslogar não pode ficar refém da
    // rede. O `signOut` do service nunca lança, e revoga do lado de lá.
    setUser(null)
    // Derruba o socket JÁ (não espera a navegação desmontar os consumidores) e
    // avisa as outras abas para caírem juntas.
    socketService.disconnect()
    channelRef.current?.postMessage('logout' satisfies SessionMessage)
    await authService.signOut()
  }, [])

  const value = useMemo<AuthState>(
    () => ({ user, isAuthenticated: user !== null, restoring, signIn, signUp, signOut }),
    [user, restoring, signIn, signUp, signOut],
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
