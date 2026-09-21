import { useLayoutEffect } from 'react'
import { Outlet, createFileRoute } from '@tanstack/react-router'

/**
 * Layout visual das telas públicas. A restauração é aguardada antes dos filhos
 * para que convite e verificação também recebam o usuário correto sem flash.
 */
export const Route = createFileRoute('/$lang/_public')({
  beforeLoad: async ({ context }) => {
    await context.auth.ensureSession()
  },
  component: PublicLayout,
})

function PublicLayout() {
  // As telas públicas têm temas fixos (light no cadastro, purple no login),
  // sem alternância. A preferência continua intacta: ao sair daqui, o tema
  // anterior da área autenticada é restaurado.
  useLayoutEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')

    return () => {
      root.classList.toggle('dark', wasDark)
    }
  }, [])

  return <Outlet />
}
