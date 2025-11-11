import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(new URL('.', import.meta.url)))
const CLIENT_LOG_ENDPOINTS = ['/__client-log', '/api/log']
const LOG_DIR = path.resolve(__dirname, 'diagnostics')
const LOG_FILE = path.join(LOG_DIR, 'client-auth.log')

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Use /configurator/ for production, / for development
  base: mode === 'production' ? '/configurator/' : '/',
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
      path: '/',
      timeout: 30000,
    },
  },
  plugins: [
    react(),
    {
      name: 'client-log-writer',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Check if request matches any log endpoint
          if (!CLIENT_LOG_ENDPOINTS.includes(req.url || '')) {
            return next()
          }

          if (req.method !== 'POST') {
            return next()
          }

          let body = ''
          req.setEncoding('utf8')
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', () => {
            try {
              const payload = body ? JSON.parse(body) : {}
              const timestamp = new Date().toISOString()
              const entry = `${timestamp} ${payload.level ?? 'info'} ${payload.scope ?? 'app'} ${JSON.stringify(payload.message ?? payload)}\n`
              fs.mkdirSync(LOG_DIR, { recursive: true })
              fs.appendFileSync(LOG_FILE, entry, { encoding: 'utf8' })
              res.statusCode = 204
              res.end()
            } catch (error) {
              console.error('[client-log-writer] failed to persist log', error)
              res.statusCode = 500
              res.end()
            }
          })
        })
      },
    },
  ],
}))
