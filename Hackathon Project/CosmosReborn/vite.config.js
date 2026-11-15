import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { answerAssist } from './server/assist.js'

/**
 * Dev/preview only. In production the same handler is served by server.js, so the
 * SerpApi key is read from the environment on whichever host runs the server.
 */
function geminiAssistant(env) {
  const key = env.SERPAPI_KEY || process.env.SERPAPI_KEY

  const middleware = async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/api/assist') return next()

    const send = (status, body) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(body))
    }

    if (req.method !== 'GET') return send(405, { error: 'USE GET' })
    const { status, body } = await answerAssist({
      query: url.searchParams.get('q'),
      token: url.searchParams.get('token'),
      context: url.searchParams.get('ctx'),
      key,
    })
    send(status, body)
  }

  return {
    name: 'gemini-assistant',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), geminiAssistant(env)],
  }
})
