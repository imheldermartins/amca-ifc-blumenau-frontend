import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Fonte padrão do app (auto-hospedada, variável 100–900). O nome da família
// é 'Noto Sans Variable' — referenciado em --font-sans no index.css.
// Caminho .css explícito p/ casar com a declaração *.css do vite/client.
import '@fontsource-variable/noto-sans/index.css'
import '@/lib/i18n'
import './index.css'

import { AppRouter } from '@/AppRouter'
import { AuthProvider } from '@/contexts/AuthContext'
import { FeedbackProvider } from '@/contexts/FeedbackContext'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  </StrictMode>,
)
