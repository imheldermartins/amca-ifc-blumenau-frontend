import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // tanstackRouter must come before react()
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@locales': path.resolve(__dirname, './src/locales'),
      // Libs autorais: a FONTE é src/shared/<nome> (edite lá); packages/<nome>
      // é o snapshot versionável. O alias garante que o app consome a fonte,
      // não o node_modules.
      'cubs-database': path.resolve(__dirname, './src/shared/cubs-database'),
      'cubs-components': path.resolve(__dirname, './src/shared/cubs-components'),
    },
  },
  server: {
    // O dev server recusa requisições cujo Host ele não conhece (defesa contra
    // DNS rebinding). Um túnel serve o app num hostname aleatório
    // (`*.trycloudflare.com`), então ele precisa ser liberado — só o sufixo,
    // nunca `true`, que aceitaria qualquer host.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      // Sem VITE_CUBS_API_URL, a base HTTP é /api/v1 e o Vite preserva esse
      // caminho ao encaminhá-lo para o backend Express.
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // WebSocket do socket.io: MESMO backend da API, com upgrade de
      // protocolo (ws) — não é um servidor separado.
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
