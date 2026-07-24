import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'

// Fonte padrão do app (auto-hospedada, variável 100–900). O nome da família
// é 'Noto Sans Variable' — referenciado em --font-sans no index.css.
// Caminho .css explícito p/ casar com a declaração *.css do vite/client.
import '@fontsource-variable/noto-sans/index.css'
import '@/lib/i18n'
import './index.css'

import { AuthProvider } from '@/contexts/AuthContext'
import { FeedbackProvider } from '@/contexts/FeedbackContext'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  </StrictMode>,
)
