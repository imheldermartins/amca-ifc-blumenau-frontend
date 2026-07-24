import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Config de teste SEPARADA do `vite.config.ts` de propósito: aquele carrega o
 * plugin do TanStack Router (que regenera `routeTree.gen.ts`) e o Tailwind —
 * nenhum dos dois tem o que fazer num test runner, e o do router escreveria
 * arquivo no meio da suíte.
 *
 * Os aliases são espelhados na mão pelo mesmo motivo que o `nginx.conf`
 * espelha o `API_BASE_PATH`: config não importa config sem arrastar os plugins
 * junto. Mudou lá, mude aqui.
 *
 * Escopo da suíte (decisão do plano): cobre o que decide SEGURANÇA e o que é
 * lógica pura e verificável — política de sessão, merge de realtime,
 * storage e os utils da tabela. Não há teste de aparência.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@locales': path.resolve(__dirname, './src/locales'),
      'cubs-database': path.resolve(__dirname, './src/shared/cubs-database'),
      'cubs-components': path.resolve(__dirname, './src/shared/cubs-components'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
