import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const EDITOR_IMAGE_UPLOAD_PATH = '/__cubs-editor-image-upload'
const MAX_IMAGE_UPLOAD_BYTES = 25 * 1024 * 1024
const MAX_IMAGE_REQUEST_BYTES = 36 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function sendJson(response: ServerResponse, status: number, payload: object) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_IMAGE_REQUEST_BYTES) throw new RangeError('Request too large.')
    chunks.push(buffer)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function safeImageBaseName(originalName: string): string {
  const withoutExtension = path.basename(originalName, path.extname(originalName))
  const safeName = withoutExtension
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return safeName || 'image'
}

function editorImageUploadPlugin(): Plugin {
  return {
    name: 'cubs-editor-image-upload',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(EDITOR_IMAGE_UPLOAD_PATH, (request, response, next) => {
        if (request.method !== 'POST') {
          next()
          return
        }

        void (async () => {
          try {
            const body = await readJsonBody(request)
            if (!body || typeof body !== 'object') {
              sendJson(response, 400, { message: 'Invalid upload payload.' })
              return
            }

            const { dataUrl, originalName } = body as Record<string, unknown>
            if (typeof dataUrl !== 'string' || typeof originalName !== 'string') {
              sendJson(response, 400, { message: 'Invalid upload payload.' })
              return
            }

            const match = dataUrl.match(/^data:([^;,]+);base64,([a-zA-Z0-9+/]+={0,2})$/)
            const mimeType = match?.[1]
            const extension = mimeType ? IMAGE_EXTENSIONS[mimeType] : undefined
            if (!match || !extension) {
              sendJson(response, 415, { message: 'Unsupported image type.' })
              return
            }

            const image = Buffer.from(match[2], 'base64')
            if (image.length === 0 || image.length > MAX_IMAGE_UPLOAD_BYTES) {
              sendJson(response, 413, { message: 'Image is empty or too large.' })
              return
            }

            const uploadsDirectory = path.join(
              os.homedir(),
              'Downloads',
              'uploads-from-cubs',
            )
            const fileName = `${Date.now()}-${safeImageBaseName(originalName)}-${randomUUID().slice(0, 8)}.${extension}`
            await mkdir(uploadsDirectory, { recursive: true })
            await writeFile(path.join(uploadsDirectory, fileName), image, { flag: 'wx' })
            sendJson(response, 201, { fileName })
          } catch (error) {
            const status = error instanceof RangeError ? 413 : 500
            sendJson(response, status, { message: 'Image could not be saved.' })
          }
        })()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    editorImageUploadPlugin(),
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
